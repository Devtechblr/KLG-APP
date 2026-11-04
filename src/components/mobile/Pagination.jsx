import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, total, label = 'orders', onPage }) {
  if (pages <= 1) return total ? <p className="pager-info center">{total} {label}</p> : null;
  return (
    <div className="pager">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft size={18} /> Prev
      </button>
      <span className="pager-info">Page <b>{page}</b> of {pages}<small>{total} {label}</small></span>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        Next <ChevronRight size={18} />
      </button>
    </div>
  );
}
