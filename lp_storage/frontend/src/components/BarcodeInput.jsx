import { ScanBarcode } from 'lucide-react'

/**
 * BarcodeInput — camera-based barcode scanning.
 * TODO: implement using a library such as @zxing/browser or quagga2.
 * For now the button is visible but triggers a 501 notice.
 */
export default function BarcodeInput({ onDetected }) {
  function handleClick() {
    alert('Barcode scanning is not yet implemented.\nUse the text search instead.')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Scan barcode (coming soon)"
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:opacity-80"
      style={{
        background: 'var(--color-card)',
        color: 'var(--color-muted)',
        border: '1px solid var(--color-border)',
      }}
    >
      <ScanBarcode size={16} />
      <span>Scan barcode</span>
    </button>
  )
}
