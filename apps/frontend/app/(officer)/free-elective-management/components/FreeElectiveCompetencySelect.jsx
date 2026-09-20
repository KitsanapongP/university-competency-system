import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

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
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState(null);
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

    const updateMenuPosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) {
            return;
        }

        const triggerRect = trigger.getBoundingClientRect();
        const viewportPadding = 8;
        const menuWidth = Math.min(
            Math.max(triggerRect.width, 280),
            window.innerWidth - (viewportPadding * 2),
        );
        const estimatedMenuHeight = 300;
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const shouldOpenAbove = (
            spaceBelow < estimatedMenuHeight
            && triggerRect.top > estimatedMenuHeight
        );
        const top = shouldOpenAbove
            ? Math.max(
                viewportPadding,
                triggerRect.top - estimatedMenuHeight - 4,
            )
            : Math.min(
                triggerRect.bottom + 4,
                window.innerHeight - viewportPadding - 160,
            );
        const left = Math.min(
            Math.max(triggerRect.left, viewportPadding),
            window.innerWidth - menuWidth - viewportPadding,
        );

        setMenuPosition({
            top,
            left,
            width: menuWidth,
        });
    }, []);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        updateMenuPosition();
        const handlePointerDown = (event) => {
            const clickedTrigger = containerRef.current?.contains(event.target);
            const clickedMenu = menuRef.current?.contains(event.target);
            if (!clickedTrigger && !clickedMenu) {
                setOpen(false);
                setSearch('');
                setMenuPosition(null);
            }
        };
        const handleViewportChange = () => updateMenuPosition();

        document.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [open, updateMenuPosition]);

    const choose = (item) => {
        onChange(item.id);
        setOpen(false);
        setSearch('');
        setMenuPosition(null);
    };

    const menu = open && menuPosition ? (
        <div
            ref={menuRef}
            className="free-elective-competency-select__menu"
            style={menuPosition}
        >
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
    ) : null;

    return (
        <div ref={containerRef} className="free-elective-competency-select">
            <button
                type="button"
                ref={triggerRef}
                className="free-elective-competency-select__trigger"
                aria-expanded={open}
                aria-haspopup="listbox"
                disabled={disabled}
                onClick={() => setOpen((current) => {
                    if (current) {
                        setSearch('');
                        setMenuPosition(null);
                    }
                    return !current;
                })}
            >
                <span>
                    {selected
                        ? competencyName(selected, language)
                        : labels.chooseCompetency}
                </span>
                <ChevronDown size={15} aria-hidden="true" />
            </button>
            {typeof document !== 'undefined' && createPortal(menu, document.body)}
        </div>
    );
}
