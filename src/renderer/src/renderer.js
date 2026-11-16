import '../assets/main.css'
import { handleNavBar } from './handle-navbar.js'

const state = {
  page: 1,
  pageSize: 10,
  search: ''
}

let requestId = 0
let searchTimeout
let totalRecords = 0

const showElectorDetails = (elector) => {
  const fields = {
    id: elector.id,
    nacionalidad: elector.nacionalidad,
    cedula: elector.cedula,
    'apellidos-nombres': elector.apellidos_nombres,
    centro: elector.centro,
    'fecha-nacimiento': elector.fecha_nacimiento
  }

  for (const [field, value] of Object.entries(fields)) {
    document.getElementById(`elector-${field}`).value = value == null ? '' : String(value)
  }

  document.getElementById('modal-title').textContent = `Información del elector ${elector.id}`
  const modal = document.getElementById('modal')
  modal.classList.remove('hidden')
  modal.classList.add('flex')
}

const showCreateElectorModal = () => {
  const form = document.getElementById('nuevo-elector-form')
  form.reset()
  document.getElementById('nuevo-elector-message').textContent = ''
  const modal = document.getElementById('nuevo-elector-modal')
  modal.classList.remove('hidden')
  modal.classList.add('flex')
  document.getElementById('nuevo-elector-nacionalidad').focus()
}

const hideCreateElectorModal = () => {
  const modal = document.getElementById('nuevo-elector-modal')
  modal.classList.add('hidden')
  modal.classList.remove('flex')
}

const createMessageRow = (message) => {
  const row = document.createElement('tr')
  const cell = document.createElement('td')
  cell.colSpan = 3
  cell.colSpan = 4
  cell.className = 'border border-gray-300 px-4 py-6 text-center text-slate-500'
  cell.textContent = message
  row.append(cell)
  return row
}

const renderElectores = (rows, total) => {
  totalRecords = total
  const tableBody = document.getElementById('electores-table-body')
  tableBody.replaceChildren()

  if (rows.length === 0) {
    tableBody.append(
      createMessageRow(
        state.search ? 'No se encontraron electores.' : 'No hay electores registrados.'
      )
    )
  } else {
    for (const elector of rows) {
      const row = document.createElement('tr')
      row.className = 'hover:bg-slate-50'

      for (const value of [elector.id, elector.cedula, elector.apellidos_nombres]) {
        const cell = document.createElement('td')
        cell.className = 'border border-gray-300 px-4 py-1 text-center'
        cell.textContent = value == null ? '' : String(value)
        row.append(cell)
      }

      const actionsCell = document.createElement('td')
      actionsCell.className = 'w-14 border border-gray-300 px-2 py-1 text-center'

      const openModalButton = document.createElement('button')
      openModalButton.type = 'button'
      openModalButton.className =
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500'
      openModalButton.setAttribute('aria-label', `Más opciones para elector ${elector.id}`)
      openModalButton.setAttribute('aria-haspopup', 'dialog')
      openModalButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
      openModalButton.addEventListener('click', () => {
        showElectorDetails(elector)
      })

      actionsCell.append(openModalButton)
      row.append(actionsCell)
      tableBody.append(row)
    }
  }

  tableBody.classList.remove('hidden')
  document.getElementById('elector-count').textContent = `Total de registros: ${total}`

  const pageCount = Math.ceil(total / state.pageSize)
  document.getElementById('page-indicator').textContent =
    `${total === 0 ? 0 : state.page} de ${pageCount}`
  document.getElementById('previous-page').disabled = state.page <= 1
  document.getElementById('next-page').disabled = state.page >= pageCount
}

const showLoadError = (error) => {
  console.error('No se pudieron cargar los electores:', error)
  const tableBody = document.getElementById('electores-table-body')
  tableBody.replaceChildren(
    createMessageRow(`No se pudieron cargar los electores: ${error.message}`)
  )
  tableBody.classList.remove('hidden')
  document.getElementById('elector-count').textContent = 'Error al cargar los registros'
  document.getElementById('page-indicator').textContent = '—'
  document.getElementById('previous-page').disabled = true
  document.getElementById('next-page').disabled = true
}

const loadElectores = async () => {
  const currentRequestId = ++requestId

  try {
    const result = await window.electoresAPI.listar(state)
    if (currentRequestId !== requestId) return

    const pageCount = Math.ceil(result.total / state.pageSize)
    if (pageCount > 0 && state.page > pageCount) {
      state.page = pageCount
      return loadElectores()
    }

    renderElectores(result.rows, result.total)
  } catch (error) {
    if (currentRequestId === requestId) showLoadError(error)
  }
}

const main = () => {
  handleNavBar()

  const createElectorModal = document.getElementById('nuevo-elector-modal')
  const createElectorForm = document.getElementById('nuevo-elector-form')
  const createElectorMessage = document.getElementById('nuevo-elector-message')
  const createElectorSubmit = document.getElementById('guardar-nuevo-elector')

  document.getElementById('nuevo-elector-desktop-btn').addEventListener('click', showCreateElectorModal)
  document.getElementById('nuevo-mobile-btn').addEventListener('click', showCreateElectorModal)
  document.getElementById('cerrar-nuevo-elector').addEventListener('click', hideCreateElectorModal)
  document.getElementById('cancelar-nuevo-elector').addEventListener('click', hideCreateElectorModal)
  createElectorModal.addEventListener('click', (event) => {
    if (event.target === createElectorModal) hideCreateElectorModal()
  })

  createElectorForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    createElectorSubmit.disabled = true
    createElectorMessage.textContent = 'Guardando elector...'
    createElectorMessage.className = 'text-sm text-slate-600 sm:col-span-2'

    const formData = new FormData(createElectorForm)
    const elector = Object.fromEntries(formData.entries())

    try {
      await window.electoresAPI.crear(elector)
      hideCreateElectorModal()
      state.page = 1
      state.search = ''
      document.getElementById('elector-search').value = ''
      await loadElectores()
    } catch (error) {
      console.error('No se pudo guardar el elector:', error)
      createElectorMessage.textContent = error.message || 'No se pudo guardar el elector.'
      createElectorMessage.className = 'text-sm text-red-600 sm:col-span-2'
    } finally {
      createElectorSubmit.disabled = false
    }
  })

  const modal = document.getElementById('modal')
  const closeModal = () => {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
  }

  document.getElementById('closeModal').addEventListener('click', closeModal)
  document.getElementById('closeModalBtn').addEventListener('click', closeModal)

  document.getElementById('previous-page').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1
      loadElectores()
    }
  })

  document.getElementById('next-page').addEventListener('click', () => {
    state.page += 1
    loadElectores()
  })

  document.getElementById('page-size').addEventListener('change', (event) => {
    state.pageSize = Number(event.currentTarget.value)
    state.page = 1
    loadElectores()
  })

  document.getElementById('elector-search').addEventListener('input', (event) => {
    window.clearTimeout(searchTimeout)
    state.search = event.currentTarget.value
    state.page = 1
    searchTimeout = window.setTimeout(loadElectores, 250)
  })

  document.getElementById('go-to-page-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const input = document.getElementById('go-to-page')
    const requestedPage = Number(input.value)
    const pageCount = Math.ceil(totalRecords / state.pageSize)

    if (Number.isSafeInteger(requestedPage) && requestedPage > 0) {
      state.page = Math.min(requestedPage, Math.max(pageCount, 1))
      input.value = ''
      loadElectores()
    }
  })

  loadElectores()
}

document.addEventListener('DOMContentLoaded', main)
