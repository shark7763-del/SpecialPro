const taipeiFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function getTaipeiNow() {
  return new Date()
}

export function getTaipeiDateString() {
  return taipeiFormatter.format(getTaipeiNow()).slice(0, 10)
}

export function getTaipeiTimeString() {
  return taipeiFormatter.format(getTaipeiNow()).slice(11, 16)
}

export function getTaipeiISOString() {
  return getTaipeiNow().toISOString()
}
