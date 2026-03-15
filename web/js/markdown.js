// ========================================
// StockandCrypto - Markdown Rendering
// Uses marked.js + highlight.js
// ========================================

(function() {
    'use strict';

    // Load external libraries
    const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    const HIGHLIGHT_CDN = 'https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js';
    const HIGHLIGHT_CSS = 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css';

    let markedLoaded = false;
    let highlightLoaded = false;
    let markdownFallbackWarned = false;

    // Dynamically load scripts
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function loadStylesheet(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    // Initialize marked with options
    function configureMarked() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (e) {}
                    }
                    if (typeof hljs !== 'undefined') {
                        return hljs.highlightAuto(code).value;
                    }
                    return code;
                }
            });
        }
    }

    // Load libraries on demand
    async function ensureLibrariesLoaded() {
        if (!markedLoaded) {
            await loadScript(MARKED_CDN);
            markedLoaded = true;
        }
        if (!highlightLoaded) {
            await loadScript(HIGHLIGHT_CDN);
            loadStylesheet(HIGHLIGHT_CSS);
            highlightLoaded = true;
        }
        configureMarked();
    }

    // Render markdown to HTML
    function renderFallbackMarkdown(text) {
        const source = String(text || '').replace(/\r\n/g, '\n');
        const escaped = escapeHtml(source);
        const blocks = escaped.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
        if (!blocks.length) {
            return '';
        }

        return blocks.map((block) => {
            if (/^###\s+/.test(block)) {
                return `<h3>${inlineMarkdown(block.replace(/^###\s+/, ''))}</h3>`;
            }
            if (/^##\s+/.test(block)) {
                return `<h2>${inlineMarkdown(block.replace(/^##\s+/, ''))}</h2>`;
            }
            if (/^#\s+/.test(block)) {
                return `<h1>${inlineMarkdown(block.replace(/^#\s+/, ''))}</h1>`;
            }
            if (/^>\s+/.test(block)) {
                return `<blockquote>${inlineMarkdown(block.replace(/^>\s+/, ''))}</blockquote>`;
            }
            if (/^-\s+/m.test(block)) {
                const items = block.split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => line.replace(/^-\s+/, ''))
                    .map((line) => `<li>${inlineMarkdown(line)}</li>`)
                    .join('');
                return `<ul>${items}</ul>`;
            }
            return `<p>${inlineMarkdown(block).replace(/\n/g, '<br>')}</p>`;
        }).join('');
    }

    function inlineMarkdown(value) {
        return String(value || '')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    async function renderMarkdown(text) {
        try {
            await ensureLibrariesLoaded();
        } catch (error) {
            if (!markdownFallbackWarned) {
                console.warn('Markdown libraries unavailable, using fallback renderer:', error.message);
                markdownFallbackWarned = true;
            }
            return renderFallbackMarkdown(text);
        }

        if (typeof marked === 'undefined') {
            return renderFallbackMarkdown(text);
        }
        try {
            return marked.parse(text || '');
        } catch (e) {
            console.error('Markdown parse error:', e);
            return renderFallbackMarkdown(text);
        }
    }

    // Render with sanitization
    function renderMarkdownSafe(text) {
        const rawHtml = renderMarkdown(text);
        // Basic sanitization - remove script tags and dangerous attributes
        return rawHtml.then(html => {
            return html
                .replace(/<script\b[^<]*(-:(-!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/on\w+='[^']*'/gi, '')
                .replace(/javascript:/gi, '');
        });
    }

    // Create a live preview editor
    function createMarkdownEditor(container, options = {}) {
        const {
            previewHeight = '300px',
            onPreview = null,
            debounceMs = 300
        } = options;

        const wrapper = document.createElement('div');
        wrapper.className = 'markdown-editor';

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'markdown-input-wrapper';

        const input = document.createElement('textarea');
        input.className = 'form-textarea markdown-input';
        input.placeholder = 'Write in Markdown... Supports **bold**, *italic*, `code`, [links](url), and more.';
        input.rows = 12;
        input.style.fontFamily = 'var(--font-mono)';

        const toolbar = document.createElement('div');
        toolbar.className = 'markdown-toolbar';
        toolbar.innerHTML = `
            <button type="button" data-action="bold" title="Bold (Ctrl+B)">
                <strong>B</strong>
            </button>
            <button type="button" data-action="italic" title="Italic (Ctrl+I)">
                <em>I</em>
            </button>
            <button type="button" data-action="code" title="Inline Code">
                <code>&lt;/&gt;</code>
            </button>
            <button type="button" data-action="link" title="Link">
                Link
            </button>
            <button type="button" data-action="heading" title="Heading">
                H
            </button>
            <button type="button" data-action="list" title="List">
                -
            </button>
            <button type="button" data-action="quote" title="Quote">
                "
            </button>
            <button type="button" data-action="hr" title="Divider">
                --
            </button>
            <button type="button" data-action="image" title="Image">
                Image
            </button>
            <button type="button" data-action="table" title="Table">
                Table
            </button>
        `;

        const previewWrapper = document.createElement('div');
        previewWrapper.className = 'markdown-preview-wrapper';
        previewWrapper.style.display = 'none';

        const previewToggle = document.createElement('button');
        previewToggle.type = 'button';
        previewToggle.className = 'btn btn-secondary btn-sm';
        previewToggle.innerHTML = 'Preview';
        previewToggle.style.marginLeft = 'auto';

        const preview = document.createElement('div');
        preview.className = 'markdown-preview';
        preview.style.minHeight = previewHeight;
        preview.style.padding = '1rem';
        preview.style.background = 'rgba(255, 255, 255, 0.02)';
        preview.style.borderRadius = 'var(--radius-md)';
        preview.style.overflowY = 'auto';

        // Add toolbar styles
        const style = document.createElement('style');
        style.textContent = `
            .markdown-toolbar {
                display: flex;
                gap: 0.25rem;
                padding: 0.5rem 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 0.5rem;
            }
            .markdown-toolbar button {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: var(--radius-sm);
                padding: 0.25rem 0.5rem;
                color: var(--text-secondary);
                cursor: pointer;
                font-size: 0.8rem;
                transition: all 0.2s;
            }
            .markdown-toolbar button:hover {
                background: rgba(0, 229, 255, 0.1);
                border-color: var(--accent-primary);
                color: var(--text-primary);
            }
            .markdown-preview h1 { font-size: 1.75rem; margin: 1rem 0 0.5rem; }
            .markdown-preview h2 { font-size: 1.5rem; margin: 1rem 0 0.5rem; }
            .markdown-preview h3 { font-size: 1.25rem; margin: 0.75rem 0 0.5rem; }
            .markdown-preview p { margin: 0.5rem 0; line-height: 1.6; }
            .markdown-preview ul, .markdown-preview ol { margin: 0.5rem 0; padding-left: 1.5rem; }
            .markdown-preview li { margin: 0.25rem 0; }
            .markdown-preview code {
                background: rgba(0, 0, 0, 0.3);
                padding: 0.15rem 0.4rem;
                border-radius: 4px;
                font-family: var(--font-mono);
                font-size: 0.85em;
            }
            .markdown-preview pre {
                background: rgba(0, 0, 0, 0.4);
                padding: 1rem;
                border-radius: var(--radius-md);
                overflow-x: auto;
                margin: 0.75rem 0;
            }
            .markdown-preview pre code {
                background: none;
                padding: 0;
            }
            .markdown-preview blockquote {
                border-left: 3px solid var(--accent-primary);
                padding-left: 1rem;
                margin: 0.75rem 0;
                color: var(--text-muted);
                font-style: italic;
            }
            .markdown-preview a { color: var(--accent-primary); text-decoration: underline; }
            .markdown-preview table {
                width: 100%;
                border-collapse: collapse;
                margin: 0.75rem 0;
            }
            .markdown-preview th, .markdown-preview td {
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 0.5rem;
                text-align: left;
            }
            .markdown-preview th { background: rgba(0, 229, 255, 0.1); }
            .markdown-preview img { max-width: 100%; border-radius: var(--radius-md); }
            .markdown-preview hr {
                border: none;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                margin: 1rem 0;
            }
        `;
        document.head.appendChild(style);

        // Toolbar actions
        toolbar.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.dataset.action;
            const actions = {
                bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
                italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
                code: { prefix: '`', suffix: '`', placeholder: 'code' },
                link: { prefix: '[', suffix: '](url)', placeholder: 'link text' },
                heading: { prefix: '## ', suffix: '', placeholder: 'Heading' },
                list: { prefix: '- ', suffix: '', placeholder: 'list item' },
                quote: { prefix: '> ', suffix: '', placeholder: 'quote' },
                hr: { prefix: '\n---\n', suffix: '', placeholder: '' },
                image: { prefix: '![', suffix: '](image-url)', placeholder: 'alt text' },
                table: { prefix: '| Header | Header |\n|--------|--------|\n| Cell   | Cell   |', suffix: '', placeholder: '' }
            };

            if (actions[action]) {
                const { prefix, suffix, placeholder } = actions[action];
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const selected = input.value.substring(start, end) || placeholder;
                input.value = input.value.substring(0, start) + prefix + selected + suffix + input.value.substring(end);
                input.focus();
                input.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
                updatePreview();
            }
        });

        // Preview toggle
        previewToggle.addEventListener('click', () => {
            const isHidden = previewWrapper.style.display === 'none';
            previewWrapper.style.display = isHidden ? 'block' : 'none';
            previewToggle.innerHTML = isHidden ? 'Edit' : 'Preview';
            if (isHidden) updatePreview();
        });

        // Debounced preview update
        let debounceTimer;
        async function updatePreview() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const text = input.value;
                const html = await renderMarkdownSafe(text);
                preview.innerHTML = html;
                if (onPreview) onPreview(html);
            }, debounceMs);
        }

        input.addEventListener('input', updatePreview);

        // Keyboard shortcuts
        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'b') {
                    e.preventDefault();
                    toolbar.querySelector('[data-action="bold"]').click();
                } else if (e.key === 'i') {
                    e.preventDefault();
                    toolbar.querySelector('[data-action="italic"]').click();
                }
            }
        });

        // Assemble
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.alignItems = 'center';
        headerRow.style.gap = '0.5rem';
        headerRow.appendChild(toolbar);
        headerRow.appendChild(previewToggle);

        inputWrapper.appendChild(headerRow);
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(previewWrapper);
        previewWrapper.appendChild(preview);
        wrapper.appendChild(inputWrapper);

        if (container) {
            container.appendChild(wrapper);
        }

        return {
            wrapper,
            input,
            preview,
            getValue: () => input.value,
            setValue: (text) => {
                input.value = text;
                updatePreview();
            },
            getHTML: () => preview.innerHTML,
            focus: () => input.focus()
        };
    }

    // Escape HTML for fallback
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Export
    window.MarkdownRenderer = {
        render: renderMarkdown,
        renderSafe: renderMarkdownSafe,
        createEditor: createMarkdownEditor,
        ensureLoaded: ensureLibrariesLoaded
    };

    console.log('MarkdownRenderer module loaded');
})();
