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

    // Provide minimal inline print CSS to ensure readable output if external styles fail
    const minPrintCss = `
      <style>
        @page {
          margin: 0;
          size: A4;
        }
        /* Hide only interactive UI elements; inputs are replaced with spans in the DOM clone */
        @media print { 
          @page {
            margin: 0;
            size: A4;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          button, .no-print, .file-upload { display: none !important; }
          .print-no-border { border: none !important; }
          .print-no-bg { background: transparent !important; }
          .print-no-border-bottom { border-bottom: none !important; }
          .print-hide-hr { display: none !important; }
          .print-no-padding { padding: 0 !important; }
          .print-no-margin { margin: 0 !important; }
          hr.print-hide-hr { display: none !important; }
          input.print-no-border-bottom { border-bottom: none !important; border: none !important; }
          input.print-no-border { border: none !important; }
          .printed-value { border: none !important; }
          /* Hide browser-generated headers/footers */
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
        body{ 
          background: #fff; 
          color:#0f172a; 
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, 'Helvetica Neue', Arial;
          margin: 0;
          padding: 0;
        }
        .page{ 
          max-width: 900px; 
          margin:0 auto; 
          padding: 24px;
        }
        img{ max-width: 100%; height: auto; }
        .rich-text { word-wrap: break-word; }
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
          span.innerHTML = text || '&nbsp;';
          // Replace the input element with the span in the clone
          el.parentNode?.replaceChild(span, el);
        } catch (err) {
          // ignore any errors here
        }
      });

      // Remove any interactive UI like buttons or file inputs from the clone
      const buttons = clone.querySelectorAll('button, .no-print, .file-upload');
      buttons.forEach(btn => btn.parentElement?.removeChild(btn));

      // Use the outerHTML of the clone as content
      contentHtml = clone.outerHTML;
    }

    // Use empty title to prevent browser from adding it to print header
    // Note: Browser-generated headers/footers (date, time, page numbers, "about:blank") 
    // are controlled by browser print settings and cannot be removed programmatically.
    // Users should disable them in their browser's print dialog:
    // Chrome/Edge: More settings > Headers and footers (uncheck)
    // Firefox: More Settings > Print Headers and Footers (uncheck)
    const printTitle = ''; // Empty title to avoid "Assignment Paper" in browser header
    const full = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${printTitle}</title>${headHtml}${minPrintCss}</head><body><div class=\"page\">${contentHtml}</div></body></html>`;

    // Small debug logs
    console.log('printHtmlContent: head length', headHtml.length);
    console.log('printHtmlContent: content length', contentHtml.length);

    win.document.open();
    win.document.write(full);
    win.document.close();
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
        console.log('printHtmlContent: calling print');
        win.focus();
        win.print();
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
