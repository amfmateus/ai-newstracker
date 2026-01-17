'use client';

import React, { useState, useMemo } from 'react';
import styles from './CalendarFilter.module.css';

interface CalendarFilterProps {
    startDate: string | undefined;
    endDate: string | undefined;
    onChange: (start: string | undefined, end: string | undefined) => void;
}

export default function CalendarFilter({ startDate, endDate, onChange }: CalendarFilterProps) {
    const [viewDate, setViewDate] = useState(new Date());

    // Sync view with selected start date
    React.useEffect(() => {
        if (startDate) {
            setViewDate(new Date(startDate));
        }
    }, [startDate]);

    const start = useMemo(() => startDate ? new Date(startDate) : null, [startDate]);
    const end = useMemo(() => endDate ? new Date(endDate) : null, [endDate]);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const days = [];
        const firstDay = firstDayOfMonth(year, month);
        const totalDays = daysInMonth(year, month);

        // Padding for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    }, [viewDate]);

    const handleDateClick = (date: Date) => {
        const clickedStart = new Date(date);
        clickedStart.setHours(0, 0, 0, 0);
        const clickedEnd = new Date(date);
        clickedEnd.setHours(23, 59, 59, 999);

        // If we don't have a selection, or we already have a multi-day range, start fresh with a single day
        const isRange = start && end && start.toDateString() !== end.toDateString();

        if (!start || isRange) {
            onChange(clickedStart.toISOString(), clickedEnd.toISOString());
        } else {
            // We have a single day selected, now we are picking the second point of a potential range
            if (clickedStart.getTime() === start.getTime()) {
                // Clicking the same day again while it's the only one selected? 
                // We can either keep it or clear it. Let's keep it to allow "single day" results.
                return;
            }

            if (clickedStart < start) {
                // Select a range going backwards
                onChange(clickedStart.toISOString(), start.toISOString());
            } else {
                // Select a range going forwards
                onChange(start.toISOString(), clickedEnd.toISOString());
            }
        }
    };

    const isSelected = (date: Date) => {
        if (!date) return false;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        if (start && d.getTime() === new Date(start).setHours(0, 0, 0, 0)) return true;
        if (end && d.getTime() === new Date(end).setHours(0, 0, 0, 0)) return true;
        return false;
    };

    const isInRange = (date: Date) => {
        if (!date || !start || !end) return false;
        // Don't highlight "range" if it's the same day
        if (start.toDateString() === end.toDateString()) return false;
        return date >= start && date <= end;
    };

    const isStart = (date: Date) => {
        if (!date || !start) return false;
        return date.toDateString() === start.toDateString();
    };

    const isEnd = (date: Date) => {
        if (!date || !end) return false;
        return date.toDateString() === end.toDateString();
    };

    const changeMonth = (offset: number) => {
        const d = new Date(viewDate);
        d.setMonth(d.getMonth() + offset);
        setViewDate(d);
    };

    const isToday = (date: Date) => {
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button className={styles.navBtn} onClick={() => changeMonth(-1)}>←</button>
                <div className={styles.monthLabel}>
                    {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button className={styles.navBtn} onClick={() => changeMonth(1)}>→</button>
            </div>

            <div className={styles.weekdayRow}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className={styles.weekday}>{d}</div>
                ))}
            </div>

            <div className={styles.calendarGrid}>
                {calendarDays.map((day, i) => (
                    <div
                        key={i}
                        className={`
                            ${styles.dayCell} 
                            ${day ? styles.dayActive : styles.dayEmpty}
                            ${isSelected(day!) ? styles.daySelected : ''}
                            ${isInRange(day!) ? styles.dayInRange : ''}
                            ${isToday(day!) ? styles.dayIsToday : ''}
                            ${isStart(day!) ? styles.dayRangeStart : ''}
                            ${isEnd(day!) ? styles.dayRangeEnd : ''}
                        `}
                        onClick={() => day && handleDateClick(day)}
                    >
                        {day ? day.getDate() : ''}
                    </div>
                ))}
            </div>

            {(startDate || endDate) && (
                <button className={styles.resetBtn} onClick={() => onChange(undefined, undefined)}>
                    Reset Date Filters
                </button>
            )}
        </div>
    );
}

