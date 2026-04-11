'use client';

import { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Lock, Palette} from 'lucide-react';

const PRESET_COLORS = [
    '#ec4899','#3b82f6','#06b6d4','#f59e0b',
    '#10b981','#8b5cf6','#ef4444','#f97316',
    '#14b8a6','#a855f7','#84cc16','#0ea5e9',
];

function pickRandom(exclude = []) {
    const pool = PRESET_COLORS.filter(c => !exclude.includes(c));
    const src  = pool.length ? pool : PRESET_COLORS;
    return src[Math.floor(Math.random() * src.length)];
}

// ============================================================
// ColorPicker — ใช้ร่วมกันในทั้ง add และ edit
// ============================================================
function ColorPicker({ value, onChange }) {
    return (
        <div className="mcp-color-picker">
            <div className="mcp-color-preview" style={{ background: value }}/>
            <div className="mcp-preset-grid">
                {PRESET_COLORS.map(c => (
                    <button key={c}
                        className={`mcp-preset-dot ${value === c ? 'mcp-preset-dot--active' : ''}`}
                        style={{ background: c }}
                        onClick={() => onChange(c)}
                        title={c}
                    />
                ))}
            </div>
            <div className="mcp-color-actions">
                <label className="mcp-icon-btn" title="เลือกสีเอง">
                    <input type="color" value={value} onChange={e => onChange(e.target.value)}
                        style={{ opacity:0, position:'absolute', width:1, height:1 }}/>
                    <Palette size={16}/>
                </label>
                <button className="mcp-icon-btn" onClick={() => onChange(pickRandom())} title="สุ่มสี">🎲</button>
            </div>
        </div>
    );
}

// ============================================================
// CompetencyRow — 1 แถวในรายการ
// ============================================================
function CompetencyRow({ comp, onUpdate, onDelete }) {
    const isMaster = !!comp.fromMaster;
    const [editing, setEditing] = useState(false);
    const [name,    setName]    = useState(comp.name);
    const [color,   setColor]   = useState(comp.color);

    const handleSave = () => {
        if (!name.trim()) return;
        onUpdate({ ...comp, name: name.trim(), color });
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="mcp-row mcp-row--editing">
                <div className="mcp-row__edit-body">
                    <input
                        className="cfm-input mcp-name-input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                        autoFocus
                    />
                    <ColorPicker value={color} onChange={setColor}/>
                </div>
                <div className="mcp-row__edit-actions">
                    <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={!name.trim()}>
                        <Check size={13}/> บันทึก
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setName(comp.name); setColor(comp.color); setEditing(false); }}>
                        ยกเลิก
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mcp-row">
            <div className="mcp-row__dot" style={{ background: comp.color }}/>
            <span className="mcp-row__name">{comp.name}</span>
            {isMaster && (
                <span className="mcp-row__badge" title="Competency Master — ไม่สามารถแก้ไขชื่อหรือสีได้">
                    <Lock size={11}/> Master
                </span>
            )}
            <div className="mcp-row__actions">
                {/* Master: ไม่มีปุ่ม edit | Non-master: มีปุ่ม edit */}
                {!isMaster && (
                    <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={() => setEditing(true)} title="แก้ไข">
                        <Pencil size={13}/>
                    </button>
                )}
                <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(comp.id)} title="ลบ">
                    <Trash2 size={13}/>
                </button>
            </div>
        </div>
    );
}

/*
// ============================================================
// AddCompetencyRow — แถวเพิ่มใหม่ด้านล่าง
// ============================================================
function AddCompetencyRow({ existingColors, onAdd }) {
    const [open,  setOpen]  = useState(false);
    const [name,  setName]  = useState('');
    const [color, setColor] = useState(() => pickRandom(existingColors));

    const handleAdd = () => {
        if (!name.trim()) return;
        onAdd(name.trim(), color);
        setName('');
        setColor(pickRandom(existingColors));
        setOpen(false);
    };

    if (!open) {
        return (
            <button className="mcp-add-btn" onClick={() => setOpen(true)}>
                <Plus size={14}/> เพิ่ม Competency ใหม่
            </button>
        );
    }

    return (
        <div className="mcp-row mcp-row--editing mcp-row--new">
            <div className="mcp-row__edit-body">
                <input
                    className="cfm-input mcp-name-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setOpen(false); }}
                    placeholder="ชื่อ Competency..."
                    autoFocus
                />
                <ColorPicker value={color} onChange={setColor}/>
            </div>
            <div className="mcp-row__edit-actions">
                <button className="btn btn--primary btn--sm" onClick={handleAdd} disabled={!name.trim()}>
                    <Plus size={13}/> เพิ่ม
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>ยกเลิก</button>
            </div>
        </div>
    );
}
*/

// ============================================================
// ManageCompetencyModal — main export
// ============================================================
export default function ManageCompetencyModal({ competencies, onClose, onUpdate, onDelete, onAdd }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--mcp" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>จัดการ Competency</h3>
                    <button className="modal-close" onClick={onClose}><X size={18}/></button>
                </div>

                <div className="modal-body mcp-body">
                    <p className="mcp-hint">
                        <Lock size={12}/> <strong>Master</strong> — แก้ไขชื่อ/สีไม่ได้ แต่ลบได้ &nbsp;|&nbsp;
                        <Pencil size={12}/> <strong>ใหม่</strong> — แก้ไขและลบได้ทั้งหมด
                    </p>

                    <div className="mcp-list">
                        {competencies.map(comp => (
                            <CompetencyRow
                                key={comp.id}
                                comp={comp}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>

                    {/* <AddCompetencyRow
                        existingColors={competencies.map(c => c.color)}
                        onAdd={onAdd}
                    /> */}
                </div>

                <div className="modal-footer">
                    <button className="btn btn--primary" onClick={onClose}>เสร็จสิ้น</button>
                </div>
            </div>
        </div>
    );
}