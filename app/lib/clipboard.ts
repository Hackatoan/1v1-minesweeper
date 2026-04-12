export const copyToClipboard = async (
  text: string,
  setCopied: (value: boolean) => void
) => {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text)
    }
  } catch (error) {
    console.error('Failed to copy text:', error)
  } finally {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
}
