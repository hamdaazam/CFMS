// Utility to print a full HTML string in a new popup window
export function printHtmlContent(title: string, container: HTMLElement | string) {
  try {
    const win = window.open('', '_blank');
    console.log('printHtmlContent: window open', !!win);
    if (!win) {
      console.warn('Unable to open print popup — maybe blocked by browser.');
      return;
    }

    // Head content: clone link/style tags from current document
    const headNodes = Array.from(document.querySelectorAll('link[rel=stylesheet], style'));
    const headHtml = headNodes.map(n => n.outerHTML).join('\n');

    // Provide comprehensive print CSS for professional academic documents
    const minPrintCss = `
      <style>
        @page {
          margin: 25mm 20mm;
          size: A4;
          marks: none;
        }
        
        /* Hide browser date/time and URL in print */
        @page {
          margin: 25mm 20mm;
          size: A4;
          marks: none;
        }
        
        /* Additional CSS to hide any date/time text */
        body::before,
        body::after,
        .page::before,
        .page::after {
          display: none !important;
          content: none !important;
        }
        
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Hide only interactive UI elements; inputs are replaced with spans in the DOM clone */
        @media print { 
          @page {
            margin: 25mm 20mm;
            size: A4;
            marks: none;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          
          /* Hide scrollbars */
          ::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          * {
            overflow: visible !important;
            scrollbar-width: none !important;
          }
          
          button, .no-print, .file-upload { display: none !important; }
          .print-no-border { border: none !important; box-shadow: none !important; }
          .print-no-bg { background: transparent !important; }
          .print-no-border-bottom { border-bottom: none !important; }
          .print-hide-hr { display: none !important; }
          .print-no-padding { padding: 0 !important; }
          .print-no-margin { margin: 0 !important; }
          hr.print-hide-hr, hr { display: none !important; visibility: hidden !important; }
          input.print-no-border-bottom { border-bottom: none !important; border: none !important; }
          input.print-no-border { border: none !important; }
          .printed-value { 
            border: none !important; 
            background: transparent !important;
            display: inline !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Remove ALL borders, backgrounds, and boxes - override everything */
          * {
            border: none !important;
            border-top: none !important;
            border-right: none !important;
            border-bottom: none !important;
            border-left: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            background-color: transparent !important;
            outline: none !important;
          }
          
          /* Keep white background only on body/page */
          body, .page, html {
            background: white !important;
          }
          
          /* Remove all padding/margins from containers */
          div, section, article, form, main {
            border: none !important;
            border-top: none !important;
            border-right: none !important;
            border-bottom: none !important;
            border-left: none !important;
            box-shadow: none !important;
            background: transparent !important;
            background-color: transparent !important;
          }
          
          /* Override Tailwind utility classes */
          .border, .border-0, .border-1, .border-2, .border-4,
          .border-gray-100, .border-gray-200, .border-gray-300,
          .rounded, .rounded-md, .rounded-lg, .rounded-xl,
          .shadow, .shadow-sm, .shadow-md, .shadow-lg,
          .bg-gray-50, .bg-gray-100, .bg-white {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            background-color: transparent !important;
          }
          
          /* Make inputs look like plain text */
          input, textarea, select {
            border: none !important;
            border-top: none !important;
            border-right: none !important;
            border-bottom: none !important;
            border-left: none !important;
            background: transparent !important;
            background-color: transparent !important;
            box-shadow: none !important;
            outline: none !important;
            padding: 0 !important;
            margin: 0 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            display: inline !important;
            width: auto !important;
            height: auto !important;
            min-height: auto !important;
          }
          
          /* Rich text editor styling - make it look like plain text */
          .rich-text-editor, 
          [class*="rich-text"], 
          [class*="richtext"],
          .richtext-editor {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            outline: none !important;
          }
          
          .rich-text-editor *, 
          [class*="rich-text"] *, 
          [class*="richtext"] *,
          .richtext-editor * {
            border: none !important;
            background: transparent !important;
            outline: none !important;
          }
          
          /* ContentEditable divs should display as plain text */
          div[contenteditable="true"],
          div[contenteditable="false"] {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            outline: none !important;
            min-height: auto !important;
            display: block !important;
          }
          
          /* Page breaks */
          .page-break-before { page-break-before: always; }
          .page-break-after { page-break-after: always; }
          .avoid-page-break { page-break-inside: avoid; break-inside: avoid; }
          
          /* Typography */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          
          /* Questions should stay together */
          [class*="question"], [class*="Question"] {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Images */
          img {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid;
          }
          
          /* Tables */
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          
          /* Hide browser-generated headers/footers */
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          
          /* Additional styles to ensure clean print output */
          .page {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Ensure no extra spacing */
          body > *:not(.page) {
            display: none !important;
          }
          
          /* Hide any text that might appear from browser headers */
          body::before,
          body::after,
          html::before,
          html::after,
          .page::before,
          .page::after {
            display: none !important;
            content: none !important;
            visibility: hidden !important;
          }
          
          /* Remove any title text that might appear */
          title {
            display: none !important;
          }
          
          /* Hide any text nodes containing browser-generated content */
          body {
            position: relative;
          }
          
          /* Ensure no browser print headers appear */
          @page {
            margin: 25mm 20mm;
            size: A4;
            marks: none;
          }
        }
        
        body { 
          background: #fff; 
          color: #0f172a; 
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, 'Helvetica Neue', Arial, sans-serif;
          margin: 0;
          padding: 0;
          overflow: visible !important;
        }
        
        .page { 
          max-width: 100%;
          margin: 0 auto;
          padding: 0;
          background: white;
        }
        
        img { 
          max-width: 100%; 
          height: auto; 
        }
        
        .rich-text { 
          word-wrap: break-word; 
        }
      </style>
    `;

    // Support two input types: an element (preferred) or an HTML string.
    let contentHtml = '';
    if (typeof container === 'string') {
      contentHtml = container;
    } else if (container instanceof HTMLElement) {
      // Clone element so we don't mutate the original DOM
      const clone = container.cloneNode(true) as HTMLElement;

      // Convert input/textarea/select elements to spans that show their values
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach((el) => {
        try {
          const tag = el.tagName.toLowerCase();
          let text = '';
          if (tag === 'select') {
            const sel = el as HTMLSelectElement;
            text = sel.options[sel.selectedIndex]?.text || '';
          } else if (tag === 'input') {
            const input = el as HTMLInputElement;
            if (input.type === 'checkbox' || input.type === 'radio') {
              text = input.checked ? 'Yes' : 'No';
            } else {
              text = input.value || input.placeholder || '';
            }
          } else if (tag === 'textarea') {
            const ta = el as HTMLTextAreaElement;
            text = ta.value || ta.placeholder || '';
          }
          const span = document.createElement('span');
          span.className = 'printed-value';
          span.style.cssText = 'display: inline; border: none; background: transparent; padding: 0; margin: 0; margin-left: 0; margin-right: 0; padding-left: 0; padding-right: 0;';
          span.innerHTML = text || '&nbsp;';
          
          // Check if this is a marks input (has "Marks:" in parent or previous sibling)
          const parent = el.parentElement;
          const isMarksInput = parent && (
            (parent.textContent || '').includes('Marks:') ||
            parent.classList.contains('print:whitespace-nowrap')
          );
          
          if (isMarksInput) {
            span.style.marginLeft = '0';
            span.style.paddingLeft = '0';
            span.style.marginRight = '0';
            span.style.paddingRight = '0';
            span.style.letterSpacing = '0';
            span.style.display = 'inline';
            
            // If input is inside a span (like our new structure), remove whitespace from parent text
            if (parent && parent.tagName === 'SPAN') {
              // Remove any whitespace nodes before this input in the parent
              let prevSibling = el.previousSibling;
              while (prevSibling) {
                if (prevSibling.nodeType === Node.TEXT_NODE) {
                  const prevText = prevSibling.textContent || '';
                  if (prevText.trim() === '') {
                    // Remove whitespace-only nodes
                    const toRemove = prevSibling;
                    prevSibling = prevSibling.previousSibling;
                    toRemove.remove();
                    continue;
                  } else if (prevText.includes('Marks:')) {
                    // Remove trailing whitespace from Marks: text
                    prevSibling.textContent = prevText.replace(/\s+$/, '');
                  }
                }
                break;
              }
            } else {
              // Original structure: remove whitespace nodes before this input
              let prevSibling = el.previousSibling;
              while (prevSibling) {
                if (prevSibling.nodeType === Node.TEXT_NODE) {
                  const prevText = prevSibling.textContent || '';
                  if (prevText.trim() === '') {
                    const toRemove = prevSibling;
                    prevSibling = prevSibling.previousSibling;
                    toRemove.remove();
                    continue;
                  } else if (prevText.includes('Marks:')) {
                    prevSibling.textContent = prevText.replace(/\s+$/, '');
                  }
                }
                break;
              }
            }
          }
          
          // Replace the input element with the span in the clone
          el.parentNode?.replaceChild(span, el);
          
          // Remove any whitespace nodes after the span (especially for marks inputs)
          if (isMarksInput) {
            let nextSibling = span.nextSibling;
            while (nextSibling) {
              if (nextSibling.nodeType === Node.TEXT_NODE) {
                const nextText = nextSibling.textContent || '';
                if (nextText.trim() === '') {
                  const toRemove = nextSibling;
                  nextSibling = nextSibling.nextSibling;
                  toRemove.remove();
                } else {
                  break;
                }
              } else {
                break;
              }
            }
          }
          
          // Also check previous sibling after replacement
          if (isMarksInput) {
            const prevSibling = span.previousSibling;
            if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
              const text = prevSibling.textContent || '';
              if (text.includes('Marks:')) {
                prevSibling.textContent = text.replace(/\s+$/, '');
              }
            }
          }
        } catch (err) {
          // ignore any errors here
        }
      });

      // Remove all borders, backgrounds, and boxes from elements
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Remove borders and backgrounds via inline styles (highest priority)
        htmlEl.style.border = 'none';
        htmlEl.style.borderTop = 'none';
        htmlEl.style.borderRight = 'none';
        htmlEl.style.borderBottom = 'none';
        htmlEl.style.borderLeft = 'none';
        htmlEl.style.borderRadius = '0';
        htmlEl.style.boxShadow = 'none';
        htmlEl.style.backgroundColor = 'transparent';
        htmlEl.style.background = 'transparent';
        htmlEl.style.outline = 'none';
        
        // Remove ALL Tailwind classes that add visual styling
        const classesToRemove = [
          'border', 'border-0', 'border-1', 'border-2', 'border-4', 'border-8',
          'border-t', 'border-r', 'border-b', 'border-l',
          'border-gray-100', 'border-gray-200', 'border-gray-300', 'border-gray-400',
          'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full',
          'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg',
          'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-white',
          'bg-transparent', 'bg-opacity-50',
          'p-1', 'p-2', 'p-3', 'p-4', 'p-6', 'p-8',
          'px-1', 'px-2', 'px-3', 'px-4', 'px-6', 'px-8',
          'py-1', 'py-2', 'py-3', 'py-4', 'py-6', 'py-8',
          'm-1', 'm-2', 'm-3', 'm-4', 'm-6', 'm-8',
          'max-w-4xl', 'mx-auto'
        ];
        
        classesToRemove.forEach(cls => {
          if (htmlEl.classList.contains(cls)) {
            htmlEl.classList.remove(cls);
          }
        });
      });

      // Remove any interactive UI like buttons or file inputs from the clone
      const buttons = clone.querySelectorAll('button, .no-print, .file-upload');
      buttons.forEach(btn => btn.parentElement?.removeChild(btn));

      // Use the outerHTML of the clone as content
      contentHtml = clone.outerHTML;
    }

    // Use empty title to avoid any text appearing in browser print header
    // Note: Browser-generated headers/footers (date, time, page numbers) 
    // are controlled by browser print settings and cannot be removed programmatically.
    // Users should disable them in their browser's print dialog:
    // Chrome/Edge: More settings > Headers and footers (uncheck)
    // Firefox: More Settings > Print Headers and Footers (uncheck)
    const printTitle = ''; // Empty title to avoid any text in print header
    
    // Additional meta tags to prevent browser from adding date/time
    const additionalMeta = `
      <meta name="robots" content="noindex, nofollow">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="format-detection" content="telephone=no">
    `;
    
    const full = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">${additionalMeta}<title>${printTitle}</title>${headHtml}${minPrintCss}</head><body><div class=\"page\">${contentHtml}</div></body></html>`;

    // Small debug logs
    console.log('printHtmlContent: head length', headHtml.length);
    console.log('printHtmlContent: content length', contentHtml.length);

    win.document.open();
    win.document.write(full);
    win.document.close();
    
    // Remove any text nodes that might contain "about:blank" or date/time
    const removeUnwantedText = () => {
      try {
        const walker = win.document.createTreeWalker(
          win.document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        let node;
        const nodesToRemove: Text[] = [];
        while (node = walker.nextNode()) {
          const text = (node.textContent || '').trim();
          // Remove text containing "about:blank", dates/times, or standalone "Assignment Question Paper"
          if (text.includes('about:blank') || 
              text.match(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*(AM|PM)?$/i) || // Date/time pattern
              (text === 'Assignment Question Paper' || text === 'assignment 1')) {
            nodesToRemove.push(node as Text);
          }
        }
        nodesToRemove.forEach(n => {
          try { n.remove(); } catch (e) {}
        });
      } catch (e) {
        // Ignore errors in text node removal
      }
    };
    
    // Remove unwanted text immediately after document write
    removeUnwantedText();
    try { console.log('printHtmlContent: popup body length', win.document.body?.innerHTML?.length ?? 0); } catch (e) { console.warn('printHtmlContent: unable to read popup document body', e); }

    // Wait for styles and images to load
    const waitForReady = () => new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        try {
          const ready = win.document.readyState === 'complete';
          if (ready) {
            clearInterval(interval);
            resolve();
          }
        } catch (e) {
          // cross-origin; just resolve
          clearInterval(interval);
          resolve();
        }
      }, 150);
      // Safety timeout
      setTimeout(() => { clearInterval(interval); resolve(); }, 4000);
    });

    waitForReady().then(() => {
      try {
        // Remove unwanted text again before printing (in case DOM changed)
        removeUnwantedText();
        
        // Small delay to ensure cleanup is complete
        setTimeout(() => {
          removeUnwantedText();
          console.log('printHtmlContent: calling print');
          win.focus();
          win.print();
        }, 50);
      } catch (e) {
        console.error('printHtmlContent: error while printing', e);
      }
    }).finally(() => {
      // Close after a little while to allow the print dialog to appear on some browsers
      setTimeout(() => {
        try { win.close(); } catch (e) { }
      }, 1000);
    });

  } catch (e) {
    console.error('printHtmlContent: error', e);
  }
}
