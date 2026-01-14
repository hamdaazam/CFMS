import React from 'react';

// Read image(s) from clipboard and insert as markdown image tag at cursor
export function handlePasteAsImage(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  setValue: (newValue: string) => void
) {
  if (!e.clipboardData || !e.clipboardData.items) return;

  const items = Array.from(e.clipboardData.items);
  const imageItem = items.find(i => i.type.startsWith('image/'));
  if (!imageItem) return;

  e.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const textarea = e.currentTarget as HTMLTextAreaElement;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const insertText = `![pasted-image](${dataUrl})`;
    const newVal = before + insertText + after;
    setValue(newVal);
  };
  reader.readAsDataURL(file);
}

export default handlePasteAsImage;
