import { useImagePreviewStore } from '@/stores/imagePreview'

interface Props {
  src: string
  alt?: string
  className?: string
}

export default function ClickableImage({ src, alt = '', className = '' }: Props) {
  const open = useImagePreviewStore((s) => s.open)

  return (
    <img
      src={src}
      alt={alt}
      className={`cursor-pointer ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        open(src, alt)
      }}
    />
  )
}
