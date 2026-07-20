import { config } from '../config/index.js'

const jobs = new Map()

export function storeJob(id, data) {
  jobs.set(id, { ...data, expiresAt: Date.now() + config.JOB_TTL_MS })
}

export function getJob(id) {
  const job = jobs.get(id)
  if (!job) return null
  if (Date.now() > job.expiresAt) {
    jobs.delete(id)
    return null
  }
  return job
}

export function deleteJob(id) {
  jobs.delete(id)
}

setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now > job.expiresAt) jobs.delete(id)
  }
}, 600_000)
