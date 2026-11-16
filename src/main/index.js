import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

let db = null

const createDataBase = () => {
  // Crear el directorio (carpeta), para almacenar la base de datos
  const carpetaDatos = join(app.getPath('userData'), 'datos')
  mkdirSync(carpetaDatos, {recursive: true})

  // Crear o abrir mi base de datos
  const rutaBaseDatos = join(carpetaDatos, 'registro.sqlite')
  db = new DatabaseSync(rutaBaseDatos)

  console.log('Base de datos:', rutaBaseDatos)
  console.log(`Base de datos: ${rutaBaseDatos}`)
}

const listElectores = (_event, options) => {
  const { page, pageSize, search } = options ?? {}
  const allowedPageSizes = [10, 25, 50, 100]

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new TypeError('El número de página debe ser un entero positivo.')
  }
  if (!allowedPageSizes.includes(pageSize)) {
    throw new TypeError('El tamaño de página no es válido.')
  }
  if (typeof search !== 'string' || search.length > 200) {
    throw new TypeError('El texto de búsqueda no es válido.')
  }

  const query = search.trim()
  const offset = (page - 1) * pageSize
  if (!Number.isSafeInteger(offset)) {
    throw new TypeError('El número de página excede el límite permitido.')
  }
  const where = query
    ? `WHERE instr(lower(CAST(id AS TEXT)), lower(?)) > 0
        OR instr(lower(COALESCE(CAST(cedula AS TEXT), '')), lower(?)) > 0
        OR instr(lower(COALESCE(apellidos_nombres, '')), lower(?)) > 0`
    : ''
  const parameters = query ? [query, query, query] : []
  const total = db
    .prepare(`SELECT COUNT(*) AS total FROM electores ${where}`)
    .get(...parameters).total
  const rows = db
    .prepare(`
      SELECT id, nacionalidad, cedula, apellidos_nombres, centro, fecha_nacimiento
      FROM electores
      ${where}
      ORDER BY id
      LIMIT ? OFFSET ?
    `)
    .all(...parameters, pageSize, offset)

  return { rows, total }
}

const listaElectores = () => {
  const lista = db.prepare(
    `SELECT id, cedula, apellidos_nombres, fecha_nacimiento
     FROM electores
     LIMIT ?
     OFFSET ?
    `).all(5, 5000)

    console.table(lista)
}

const obtenerElector = () => {
  const elector = db.prepare(
    `
    SELECT id, cedula, apellidos_nombres, fecha_nacimiento
    FROM electores
    WHERE id = ?
    `
  ).get(8900)

  console.log(elector)
}

const createElector = (_event, input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Los datos del elector no son válidos.')
  }

  const elector = {
    nacionalidad: input.nacionalidad,
    cedula: input.cedula,
    apellidos_nombres: input.apellidos_nombres,
    centro: input.centro,
    fecha_nacimiento: input.fecha_nacimiento
  }

  for (const [field, value] of Object.entries(elector)) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`El campo ${field} es obligatorio.`)
    }
    elector[field] = value.trim()
  }

  elector.nacionalidad = elector.nacionalidad.toUpperCase()
  if (!['V', 'E'].includes(elector.nacionalidad)) {
    throw new TypeError('La nacionalidad debe ser V o E.')
  }
  if (!/^\d{1,20}$/.test(elector.cedula)) {
    throw new TypeError('La cédula debe contener solo números.')
  }
  if (elector.apellidos_nombres.length > 200 || elector.centro.length > 200) {
    throw new TypeError('El nombre y el centro no pueden superar 200 caracteres.')
  }

  const dateParts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(elector.fecha_nacimiento)
  if (!dateParts) {
    throw new TypeError('La fecha debe tener el formato DD/MM/AAAA.')
  }
  const [, dayText, monthText, yearText] = dateParts
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new TypeError('La fecha de nacimiento no es válida.')
  }

  const result = db.prepare(`
    INSERT INTO electores
      (nacionalidad, cedula, apellidos_nombres, centro, fecha_nacimiento)
    VALUES
      (:nacionalidad, :cedula, :apellidos_nombres, :centro, :fecha_nacimiento)
  `).run(elector)

  return { id: String(result.lastInsertRowId) }
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  }
}

app.on('will-quit', () => {
  db?.close()
})

app.whenReady().then(() => {
  //listaElectores()
  //obtenerElector()
  createDataBase()
  ipcMain.handle('electores:listar', listElectores)
  ipcMain.handle('electores:crear', createElector)
  createWindow()
})