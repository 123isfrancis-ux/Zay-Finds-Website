import { useEffect, useRef, useState } from 'react';

export default function CategoryFilter({ categories, value, onChange }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [draft, setDraft] = useState(value);
  const [more, setMore] = useState(false);
  const label = categories.find(category => category.value === value)?.label || 'All';
  const options = [{ value: '', label: 'All categories' }, ...categories];
  useEffect(() => () => { dialog.current?.close(); }, []);
  function close() { dialog.current.close(); trigger.current?.focus(); }
  return <>
    <button className="category-trigger control" ref={trigger} type="button" aria-haspopup="dialog" onClick={() => { setDraft(value); dialog.current.showModal(); }}>Category <span>{label} ▾</span></button>
    <div className="category-chips" aria-label="Category">
      {options.filter((option, index) => more || index < 7 || option.value === value).map(option =>
        <button key={option.value} type="button" className="category-chip" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.value ? option.label : 'All'}</button>
      )}
      {options.length > 7 && <button className="category-chip" type="button" aria-expanded={more} onClick={() => setMore(previous => !previous)}>{more ? 'Less' : 'More'} ▾</button>}
    </div>
    <dialog ref={dialog} className="category-sheet" aria-labelledby="category-title" onClick={event => { if (event.target === dialog.current) close(); }} onCancel={() => trigger.current?.focus()}>
      <div className="sheet-content">
        <div className="sheet-heading"><h2 id="category-title">Category</h2><button className="control" type="button" aria-label="Close categories" onClick={close}>×</button></div>
        <div className="sheet-options">{options.map(option => <button autoFocus={option.value === ''} className="category-chip" key={option.value} type="button" aria-pressed={draft === option.value} onClick={() => setDraft(option.value)}>{option.label}</button>)}</div>
        <div className="sheet-actions"><button className="control" type="button" onClick={() => setDraft('')}>Clear</button><button className="control primary" type="button" onClick={() => { onChange(draft); close(); }}>Apply</button></div>
      </div>
    </dialog>
  </>;
}
