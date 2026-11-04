/** Réduit une photo dans le navigateur (≤ 1600 px, JPEG) avant l'envoi : envoi rapide, même en 3G. */
export async function compressImage(
  file: File,
  max = 1600,
): Promise<{ mediaType: 'image/jpeg'; data: string; preview: string }> {
  if (!file.type.startsWith('image/'))
    throw new Error('Choisis une image (capture d’écran ou photo du reçu).')
  if (file.size > 15 * 1024 * 1024)
    throw new Error('Image trop lourde (15 Mo maximum).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Image illisible. Essaie une autre capture.'))
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Ton navigateur ne peut pas préparer l’image.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const preview = canvas.toDataURL('image/jpeg', 0.85)
    return { mediaType: 'image/jpeg', data: preview.split(',')[1], preview }
  } finally {
    URL.revokeObjectURL(url)
  }
}
