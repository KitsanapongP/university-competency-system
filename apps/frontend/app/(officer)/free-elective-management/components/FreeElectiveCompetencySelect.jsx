import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

function competencyName(item, language) {
    return language === 'en'
        ? item.nameEn || item.nameTh
        : item.nameTh || item.nameEn;
}

export default function FreeElectiveCompetencySelect({
    options,
    value,
    disabledIds,
    disabled,
    language,
    labels,
    onChange,
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const selected = options.find((item) => String(item.id) === String(value));

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) {
            return options;
        }
        return options.filter((item) => {
            const name = competencyName(item, language).toLocaleLowerCase();
            return name.includes(query) || String(item.code || '').toLocaleLowerCase().includes(query);
        });
    }, [language, options, search]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    const choose = (item) => {
        onChange(item.id);
        setOpen(false);
        setSearch('');
    };

    return (
        <div ref={containerRef} className="free-elective-competency-select">
            <button
                type="button"
                className="free-elective-competency-select__trigger"
                aria-expanded={open}
                aria-haspopup="listbox"
                disabled={disabled}
                onClick={() => setOpen((current) => !current)}
            >
                <span>
                    {selected
                        ? competencyName(selected, language)
                        : labels.chooseCompetency}
                </span>
                <ChevronDown size={15} aria-hidden="true" />
            </button>
            {open && (
                <div className="free-elective-competency-select__menu">
                    <label className="free-elective-competency-select__search">
                        <Search size={14} aria-hidden="true" />
                        <input
                            autoFocus
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={labels.searchCompetencies}
                            aria-label={labels.searchCompetencies}
                        />
                    </label>
                    <div
                        className="free-elective-competency-select__options"
                        role="listbox"
                        aria-label={labels.competency}
                    >
                        {filteredOptions.length ? filteredOptions.map((item) => {
                            const isCurrent = String(item.id) === String(value);
                            const isUsed = disabledIds.has(String(item.id)) && !isCurrent;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isCurrent}
                                    className="free-elective-competency-select__option"
                                    disabled={isUsed}
                                    onClick={() => choose(item)}
                                >
                                    <span>
                                        <strong>{competencyName(item, language)}</strong>
                                        <small>{item.code || '-'}</small>
                                    </span>
                                    {isCurrent && <Check size={15} aria-hidden="true" />}
                                </button>
                            );
                        }) : (
                            <span className="free-elective-competency-select__empty">
                                {labels.noMatchingCompetencies}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
