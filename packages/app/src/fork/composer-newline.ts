// Keep this fork shortcut ahead of upstream suggestion selection and delivery handling.
export function composerNewline(event: KeyboardEvent) {
  if (event.key !== "Enter" || !event.ctrlKey || event.altKey || event.isComposing) return false

  event.preventDefault()
  // Use the browser's editing operation so selection, input events and undo stay native.
  if (event.currentTarget instanceof HTMLElement && event.currentTarget.isContentEditable) {
    document.execCommand("insertLineBreak")
  }

  return true
}

export const composerAlternateKeybind = "mod+alt+enter"
