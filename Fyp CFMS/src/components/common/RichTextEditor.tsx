import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

const RichTextEditor: React.FC<Props> = ({ value = '', onChange, readOnly = false, placeholder = '', className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [innerHtml, setInnerHtml] = useState<string>(value || '');

  useEffect(() => {
    // IMPORTANT: Do not "control" contentEditable via React re-render on every keystroke,
    // otherwise the caret jumps and text appears "reversed" (characters prepend).
    // Only sync DOM when external value changes AND the editor is not focused.
    const next = value || '';
    setInnerHtml(next);
    if (ref.current && document.activeElement !== ref.current) {
      if (ref.current.innerHTML !== next) {
        ref.current.innerHTML = next;
      }
    }
  }, [value]);

  useEffect(() => {
    if (ref.current) {
      // Set contentEditable attribute and ensure it's focusable
      if (readOnly) {
        ref.current.setAttribute('contenteditable', 'false');
        ref.current.setAttribute('tabindex', '-1');
      } else {
        ref.current.setAttribute('contenteditable', 'true');
        ref.current.setAttribute('tabindex', '0');
      }
    }
  }, [readOnly]);

  const emitChange = () => {
    const h = ref.current?.innerHTML || '';
    // Keep lightweight state for placeholder, but avoid forcing DOM content via render.
    setInnerHtml(h);
    onChange && onChange(h);
  };

  const insertNodeAtCaret = (node: Node) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      // Append to the editor if no selection
      ref.current?.appendChild(node);
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    // Move caret after inserted node
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    // If there are images in clipboard -> prevent default and insert base64 images
    const items = clipboard.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') {
        const file = it.getAsFile();
        if (file && file.type.startsWith('image/')) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.maxWidth = '100%';
          img.style.display = 'block';
          img.style.margin = '8px 0';
          insertNodeAtCaret(img);
          emitChange();
        };
        reader.readAsDataURL(file);
      });
      return;
    }

    // Otherwise allow default paste (text/html or text/plain)
    // After paste, emit change on microtask
    setTimeout(() => emitChange(), 0);
  };

  const handleInput = () => {
    emitChange();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      
      const range = sel.getRangeAt(0);
      const br = document.createElement('br');
      const bullet = document.createTextNode('• ');
      
      range.deleteContents();
      range.insertNode(br);
      range.collapse(false);
      range.insertNode(bullet);
      range.setStartAfter(bullet);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      
      emitChange();
    }
  };

  const handleBlur = () => {
    emitChange();
  };

  // Show placeholder when blank
  const showPlaceholder = !innerHtml || innerHtml === '<br>' || innerHtml.trim() === '';

  // Initialize content on mount
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML && value) {
      ref.current.innerHTML = value;
      setInnerHtml(value);
    }
  }, []);

  return (
    <div className={`richtext-editor ${className}`}>
      <div
        ref={ref}
        onInput={handleInput}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          // Ensure contentEditable is true when focused (in case of any race conditions)
          if (!readOnly && e.currentTarget.getAttribute('contenteditable') !== 'true') {
            e.currentTarget.setAttribute('contenteditable', 'true');
          }
        }}
        // Do NOT set dangerouslySetInnerHTML here; it will reset caret on every render.
        contentEditable={!readOnly}
        suppressContentEditableWarning={true}
        className={`min-h-[48px] leading-6 text-base text-left ${readOnly ? 'cursor-default' : 'cursor-text'}`}
        aria-label={placeholder}
        data-placeholder={placeholder}
        dir="ltr"
        tabIndex={readOnly ? -1 : 0}
        // Disable Grammarly (it can flip direction / break caret in contentEditable editors)
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        spellCheck={false}
        // NOTE: unicode-bidi: plaintext can cause unexpected RTL behavior when the first strong
        // character isn't clear (e.g., starting with digits). Force stable LTR editing.
        // Strongly isolate bidi so parent styles / browser heuristics can't flip typing direction
        style={{
          outline: 'none',
          direction: 'ltr',
          unicodeBidi: 'isolate',
          writingMode: 'horizontal-tb',
          textAlign: 'left',
          wordWrap: 'break-word',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          overflowX: 'hidden',
          WebkitUserSelect: 'text',
          userSelect: 'text',
        }}
      />
      {/* Placeholder is handled by CSS :empty:before via data-placeholder */}
      {showPlaceholder && !readOnly ? <div className="sr-only">{placeholder}</div> : null}
    </div>
  );
};

export default RichTextEditor;
