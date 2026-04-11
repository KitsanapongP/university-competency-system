'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Plus, Search } from 'lucide-react';
import './CompetencyTagInput.css';

const TAG_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#06b6d4','#ef4444','#84cc16'];
const getTagColor = (id) => TAG_COLORS[id % TAG_COLORS.length];

/**
 * CompetencyTagInput
 * กล่อง input ที่เลือก Competency เป็น Tag + สร้างใหม่ได้
 *
 * Props:
 *   competencies    — รายการ competency ทั้งหมด
 *   selected        — competency ที่เลือกอยู่ []
 *   onChange(arr)   — เมื่อ selected เปลี่ยน
 *   onCreateNew(name) → competency — callback สร้างใหม่
 *   placeholder     — placeholder text
 */
export default function CompetencyTagInput({
    competencies = [],
    selected = [],
    onChange,
    onCreateNew,
    placeholder = 'ค้นหาหรือสร้าง Competency...',
}) {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen]         = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const inputRef    = useRef(null);
    const containerRef = useRef(null);

    // กรองตามที่พิมพ์ และยังไม่ได้ถูกเลือก
    const filtered = competencies.filter(
        c => !selected.find(s => s.id === c.id) &&
             (c.name.toLowerCase().includes(inputValue.toLowerCase()) ||
              c.code.toLowerCase().includes(inputValue.toLowerCase()))
    );

    // ถ้าพิมพ์ชื่อใหม่ที่ยังไม่มีในระบบ
    const canCreate =
        inputValue.trim().length > 0 &&
        !competencies.find(c => c.name.toLowerCase() === inputValue.trim().toLowerCase());

    // ปิด dropdown เมื่อคลิกนอก
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setInputValue('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    //useEffect(() => { setHighlightIdx(0); }, [inputValue]);

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        setHighlightIdx(0);  // set พร้อมกันใน event handler เลย
        setIsOpen(true);
    };
    // ---- Handlers ----
    const handleSelect = (comp) => {
        onChange([...selected, comp]);
        setInputValue('');
        inputRef.current?.focus();
    };

    const handleRemove = (id) => {
        onChange(selected.filter(s => s.id !== id));
    };

    const handleCreate = () => {
        if (!canCreate || !onCreateNew) return;
        const newComp = onCreateNew(inputValue.trim());
        if (newComp) {
            onChange([...selected, newComp]);
            setInputValue('');
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        const total = filtered.length + (canCreate ? 1 : 0);
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => (i + 1) % total); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => (i - 1 + total) % total); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIdx < filtered.length) handleSelect(filtered[highlightIdx]);
            else if (canCreate) handleCreate();
        }
        else if (e.key === 'Backspace' && inputValue === '' && selected.length > 0) {
            handleRemove(selected[selected.length - 1].id);
        }
        else if (e.key === 'Escape') { setIsOpen(false); setInputValue(''); }
    };

    const showDropdown = isOpen && (filtered.length > 0 || canCreate);

    return (
        <div className="cti-wrapper" ref={containerRef}>
            {/* Input Box */}
            <div
                className={`cti-box ${isOpen ? 'cti-box--open' : ''}`}
                onClick={() => { inputRef.current?.focus(); setIsOpen(true); }}
            >
                {selected.map(comp => (
                    <span
                        key={comp.id}
                        className="cti-tag"
                        style={{ '--tag-color': comp.color || getTagColor(comp.id) }}
                    >
                        {comp.name}
                        <button
                            className="cti-tag__remove"
                            onClick={e => { e.stopPropagation(); handleRemove(comp.id); }}
                        >
                            <X size={11} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    className="cti-input"
                    value={inputValue}
                    placeholder={selected.length === 0 ? placeholder : ''}
                    onChange={e => { setInputValue(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div className="cti-dropdown">
                    <div className="cti-dropdown__hint">
                        <Search size={11} /> เลือกหรือสร้าง Competency
                    </div>

                    {filtered.map((comp, idx) => (
                        <div
                            key={comp.id}
                            className={`cti-option ${highlightIdx === idx ? 'cti-option--highlighted' : ''}`}
                            onMouseDown={() => handleSelect(comp)}
                            onMouseEnter={() => setHighlightIdx(idx)}
                        >
                            <span className="cti-option__dot" style={{ background: comp.color || getTagColor(comp.id) }} />
                            <span className="cti-option__name">{comp.name}</span>
                            <span className="cti-option__code">{comp.code}</span>
                        </div>
                    ))}

                    {canCreate && (
                        <div
                            className={`cti-option cti-option--create ${highlightIdx === filtered.length ? 'cti-option--highlighted' : ''}`}
                            onMouseDown={handleCreate}
                            onMouseEnter={() => setHighlightIdx(filtered.length)}
                        >
                            <Plus size={13} />
                            <span>สร้าง</span>
                            <span className="cti-option__create-name">{`"${inputValue.trim()}"`}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {isOpen && !showDropdown && inputValue !== '' && (
                <div className="cti-dropdown">
                    <div className="cti-dropdown__empty">ไม่พบ Competency ที่ค้นหา</div>
                </div>
            )}
        </div>
    );
}