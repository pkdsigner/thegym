// Runs server/dev.js and restarts it when /api, /lib or /server change.
// Restarts are graceful (the local database closes first), unlike a hard kill.
// If the API stops on its own (crash or a stray stop signal), it is restarted automatically,
// so the website is never left running without its API.
import { fork } from 'node:child_process'
import { watch } from 'node:fs'

const WATCHED = ['api', 'lib', 'server']
const QUICK_EXIT_MS = 5000 // exits sooner than this after starting count as a crash loop
const MAX_QUICK_EXITS = 3

let child = null
let restarting = false
let shuttingDown = false
let quickExits = 0
let startedAt = 0
let timer = null

function start() {
  startedAt = Date.now()
  child = fork('server/dev.js', [], { execArgv: ['--env-file-if-exists=.env'], stdio: 'inherit' })
  child.on('exit', (code, signal) => {
    child = null
    if (shuttingDown) return
    if (restarting) {
      restarting = false
      return start()
    }
    // Unexpected stop. Wait a moment: on Ctrl+C the watcher gets the signal too and should just exit.
    setTimeout(() => {
      if (shuttingDown) return
      quickExits = Date.now() - startedAt < QUICK_EXIT_MS ? quickExits + 1 : 0
      if (quickExits >= MAX_QUICK_EXITS) {
        console.error('✗ API keeps stopping right after it starts. Fix the error above, then save a file to try again.')
        quickExits = 0
        return
      }
      console.warn(`⚠ API stopped unexpectedly (${signal ?? `exit code ${code}`}) — restarting it`)
      start()
    }, 500)
  })
}

function restart(file) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    console.log(`↻ ${file} changed — restarting API`)
    if (!child) return start()
    restarting = true
    child.send('shutdown')
    setTimeout(() => child?.kill(), 3000) // fallback if it doesn't exit
  }, 150)
}

for (const dir of WATCHED) {
  watch(dir, { recursive: true }, (_, file) => file && file.endsWith('.js') && restart(`${dir}/${file}`))
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shuttingDown = true
    if (!child) process.exit(0)
    child.send('shutdown')
    child.on('exit', () => process.exit(0))
  })
}

start()
