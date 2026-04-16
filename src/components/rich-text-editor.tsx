import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import DOMPurify from 'dompurify'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Link as LinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'code',
  'pre',
]

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/|#)/i,
  })
}

/**
 * Wraps a plain-text value in a single <p> so legacy rows render identically to
 * formatted ones. Only `<` signifies HTML; everything else is treated as text.
 */
export function normalizeToHtml(value: string): string {
  if (!value) return ''
  if (value.includes('<')) return value
  return `<p>${value.replace(/\n/g, '<br>')}</p>`
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
  id,
  ariaLabel,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: normalizeToHtml(value),
    editable: !readOnly,
    editorProps: {
      attributes: {
        id: id ?? '',
        'aria-label': ariaLabel ?? placeholder ?? 'Rich text editor',
        class:
          'prose prose-sm min-h-[120px] max-w-none rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(sanitizeRichText(editor.getHTML()))
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = normalizeToHtml(value)
    if (current !== incoming) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={cn('space-y-2', className)}>
      {!readOnly && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-input bg-background hover:bg-accent',
    )

  return (
    <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive('bold'))}
        aria-label="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive('italic'))}
        aria-label="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        className={btn(editor.isActive('heading', { level: 2 }))}
        aria-label="Heading"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive('bulletList'))}
        aria-label="Bulleted list"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive('orderedList'))}
        aria-label="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Link URL')
          if (url === null) return
          if (url === '') {
            editor.chain().focus().unsetLink().run()
            return
          }
          editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: url, target: '_blank', rel: 'noopener noreferrer' })
            .run()
        }}
        className={btn(editor.isActive('link'))}
        aria-label="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
