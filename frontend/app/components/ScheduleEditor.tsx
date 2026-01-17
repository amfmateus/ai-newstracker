import React, { useState, useEffect } from 'react';

interface ScheduleEditorProps {
    value: string;
    onChange: (cron: string) => void;
}

type ScheduleMode = 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'advanced';

export default function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {
    const [mode, setMode] = useState<ScheduleMode>('daily');

    // State for different modes
    const [minuteInterval, setMinuteInterval] = useState(30);
    const [hourlyInterval, setHourlyInterval] = useState(1);
    const [hourlyMinute, setHourlyMinute] = useState(0);
    const [dailyInterval, setDailyInterval] = useState(1);
    const [time, setTime] = useState("09:00");
    const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0-6 (Sun-Sat)
    const [selectedDates, setSelectedDates] = useState<number[]>([]);

    // Helper: Convert UTC Hour to Local Hour
    const utcToLocalHour = (utcHour: number) => {
        const date = new Date();
        date.setUTCHours(utcHour);
        return date.getHours();
    };

    // Helper: Convert Local Hour to UTC Hour
    const localToUtcHour = (localHour: number) => {
        const date = new Date();
        date.setHours(localHour);
        return date.getUTCHours();
    };

    // Parse incoming value ONLY when it changes from the parent
    useEffect(() => {
        parseCron(value);
    }, [value]);

    const parseCron = (cron: string) => {
        if (!cron) return;
        const parts = cron.trim().split(/\s+/);
        if (parts.length < 5) return;

        const [min, hour, dom, month, dow] = parts;

        // Minute Mode: */X * * * *
        if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
            setMode('minute');
            setMinuteInterval(parseInt(min.split('/')[1]) || 15);
            return;
        }

        // Hourly Mode: MM */X * * *
        if (hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
            setMode('hourly');
            setHourlyInterval(parseInt(hour.split('/')[1]) || 1);
            setHourlyMinute(parseInt(min) || 0);
            return;
        }

        // Daily Mode: MM HH */X * *
        if (dom === '*' || dom.startsWith('*/')) {
            if (month === '*' && dow === '*' && !hour.includes(',') && !hour.includes('*') && !min.includes('*')) {
                setMode('daily');
                const interval = dom.startsWith('*/') ? parseInt(dom.split('/')[1]) : 1;
                setDailyInterval(interval);

                // Convert stored UTC hour to Local for display
                const utcH = parseInt(hour, 10);
                if (!isNaN(utcH)) {
                    const localH = utcToLocalHour(utcH);
                    setTime(`${localH.toString().padStart(2, '0')}:${min.padStart(2, '0')}`);
                }
                return;
            }
        }

        // Weekly Mode: MM HH * * 1,3,5
        if (month === '*' && dayPartIsWeekly(dow) && dom === '*' && !hour.includes('*')) {
            setMode('weekly');
            const utcH = parseInt(hour, 10);
            if (!isNaN(utcH)) {
                const localH = utcToLocalHour(utcH);
                setTime(`${localH.toString().padStart(2, '0')}:${min.padStart(2, '0')}`);
            }
            setSelectedDays(dow.split(',').map(d => parseInt(d)));
            return;
        }

        // Monthly Mode: MM HH 1,15 * *
        if (month === '*' && dow === '*' && dayPartIsDates(dom) && !hour.includes('*')) {
            setMode('monthly');
            const utcH = parseInt(hour, 10);
            if (!isNaN(utcH)) {
                const localH = utcToLocalHour(utcH);
                setTime(`${localH.toString().padStart(2, '0')}:${min.padStart(2, '0')}`);
            }
            setSelectedDates(dom.split(',').map(d => parseInt(d)));
            return;
        }

        setMode('advanced');
    };

    const dayPartIsWeekly = (dow: string) => {
        return dow !== '*' && /^[0-6,\-]+$/.test(dow);
    }

    const dayPartIsDates = (dom: string) => {
        return dom !== '*' && /^[0-9,]+$/.test(dom);
    }

    // Manual Generator: triggered by UI events
    const generateCron = (overrides: Partial<{
        mode: ScheduleMode;
        minuteInterval: number;
        hourlyInterval: number;
        hourlyMinute: number;
        dailyInterval: number;
        time: string;
        selectedDays: number[];
        selectedDates: number[];
    }> = {}) => {

        // Merge current state with overrides
        const currentMode = overrides.mode !== undefined ? overrides.mode : mode;
        const currentMinuteInterval = overrides.minuteInterval !== undefined ? overrides.minuteInterval : minuteInterval;
        const currentHourlyInterval = overrides.hourlyInterval !== undefined ? overrides.hourlyInterval : hourlyInterval;
        const currentHourlyMinute = overrides.hourlyMinute !== undefined ? overrides.hourlyMinute : hourlyMinute;
        const currentDailyInterval = overrides.dailyInterval !== undefined ? overrides.dailyInterval : dailyInterval;
        const currentTime = overrides.time !== undefined ? overrides.time : time;
        const currentSelectedDays = overrides.selectedDays !== undefined ? overrides.selectedDays : selectedDays;
        const currentSelectedDates = overrides.selectedDates !== undefined ? overrides.selectedDates : selectedDates;

        let newCron = value;

        // Parse Local Time
        let [localH, m] = currentTime.split(':').map(x => parseInt(x));
        if (isNaN(localH)) localH = 9;
        if (isNaN(m)) m = 0;

        // Convert Local Hour to UTC for Storage
        const utcH = localToUtcHour(localH);

        switch (currentMode) {
            case 'minute':
                newCron = `*/${currentMinuteInterval} * * * *`;
                break;
            case 'hourly':
                newCron = `${currentHourlyMinute} */${currentHourlyInterval} * * *`;
                break;
            case 'daily':
                const dom = currentDailyInterval > 1 ? `*/${currentDailyInterval}` : '*';
                // Use UTC hour for crontab
                newCron = `${m} ${utcH} ${dom} * *`;
                break;
            case 'weekly':
                if (currentSelectedDays.length === 0) return;
                const dow = [...currentSelectedDays].sort().join(',');
                newCron = `${m} ${utcH} * * ${dow}`;
                break;
            case 'monthly':
                if (currentSelectedDates.length === 0) return;
                const dates = [...currentSelectedDates].sort((a, b) => a - b).join(',');
                newCron = `${m} ${utcH} ${dates} * *`;
                break;
            default:
                break;
        }

        if (newCron !== value) {
            onChange(newCron);
        }
    };

    const handleModeChange = (m: ScheduleMode) => {
        setMode(m);
        // Force immediate recalculation when mode switches, using the new mode but existing state
        generateCron({ mode: m });
    };

    const daysMap = [
        { label: 'Sun', value: 0 },
        { label: 'Mon', value: 1 },
        { label: 'Tue', value: 2 },
        { label: 'Wed', value: 3 },
        { label: 'Thu', value: 4 },
        { label: 'Fri', value: 5 },
        { label: 'Sat', value: 6 },
    ];

    return (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            {/* Mode Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                {(['minute', 'hourly', 'daily', 'weekly', 'monthly', 'advanced'] as const).map(m => (
                    <button
                        key={m}
                        onClick={() => handleModeChange(m)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            border: 'none',
                            background: mode === m ? '#eff6ff' : 'transparent',
                            color: mode === m ? '#2563eb' : '#64748b',
                            fontWeight: mode === m ? 600 : 500,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            borderBottom: mode === m ? '2px solid #2563eb' : '2px solid transparent'
                        }}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div style={{ padding: '20px' }}>
                {mode === 'minute' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Run every</span>
                        <input
                            type="number" min="1" max="59"
                            value={minuteInterval}
                            onChange={e => {
                                const val = parseInt(e.target.value) || 1;
                                setMinuteInterval(val);
                                generateCron({ minuteInterval: val });
                            }}
                            style={{ padding: '6px', width: '60px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <span>minutes</span>
                    </div>
                )}

                {mode === 'hourly' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Run every</span>
                        <input
                            type="number" min="1" max="23"
                            value={hourlyInterval}
                            onChange={e => {
                                const val = parseInt(e.target.value) || 1;
                                setHourlyInterval(val);
                                generateCron({ hourlyInterval: val });
                            }}
                            style={{ padding: '6px', width: '60px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <span>hour(s) at minute</span>
                        <input
                            type="number" min="0" max="59"
                            value={hourlyMinute}
                            onChange={e => {
                                const val = parseInt(e.target.value) || 0;
                                setHourlyMinute(val);
                                generateCron({ hourlyMinute: val });
                            }}
                            style={{ padding: '6px', width: '60px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>(0-59)</span>
                    </div>
                )}

                {mode === 'daily' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Run every</span>
                        <input
                            type="number" min="1" max="31"
                            value={dailyInterval}
                            onChange={e => {
                                const val = parseInt(e.target.value) || 1;
                                setDailyInterval(val);
                                generateCron({ dailyInterval: val });
                            }}
                            style={{ padding: '6px', width: '60px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <span>day(s) at</span>
                        <input
                            type="time"
                            value={time}
                            onChange={e => {
                                const val = e.target.value;
                                setTime(val);
                                generateCron({ time: val });
                            }}
                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                    </div>
                )}

                {mode === 'weekly' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Run at</span>
                            <input
                                type="time"
                                value={time}
                                onChange={e => {
                                    const val = e.target.value;
                                    setTime(val);
                                    generateCron({ time: val });
                                }}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                            <span>on the following days:</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {daysMap.map(d => (
                                <label key={d.value} style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
                                    padding: '8px', borderRadius: '6px', border: selectedDays.includes(d.value) ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                    background: selectedDays.includes(d.value) ? '#eff6ff' : 'white'
                                }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: selectedDays.includes(d.value) ? '#1e40af' : '#64748b' }}>{d.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={selectedDays.includes(d.value)}
                                        onChange={e => {
                                            const newDays = e.target.checked
                                                ? [...selectedDays, d.value]
                                                : selectedDays.filter(x => x !== d.value);
                                            setSelectedDays(newDays);
                                            generateCron({ selectedDays: newDays });
                                        }}
                                        style={{ marginTop: '4px' }}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {mode === 'monthly' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Run at</span>
                            <input
                                type="time"
                                value={time}
                                onChange={e => {
                                    const val = e.target.value;
                                    setTime(val);
                                    generateCron({ time: val });
                                }}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                            <span>on specific dates:</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', maxWidth: '400px' }}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                                <div
                                    key={date}
                                    onClick={() => {
                                        const newDates = selectedDates.includes(date)
                                            ? selectedDates.filter(x => x !== date)
                                            : [...selectedDates, date];
                                        setSelectedDates(newDates);
                                        generateCron({ selectedDates: newDates });
                                    }}
                                    style={{
                                        padding: '6px', textAlign: 'center', borderRadius: '4px', fontSize: '0.9rem', cursor: 'pointer',
                                        background: selectedDates.includes(date) ? '#2563eb' : 'white',
                                        color: selectedDates.includes(date) ? 'white' : '#334155',
                                        border: '1px solid #e2e8f0'
                                    }}
                                >
                                    {date}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {mode === 'advanced' && (
                    <div>
                        <input
                            type="text"
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full p-2 border rounded font-mono"
                            style={{ width: '100%', padding: '8px', fontFamily: 'monospace', border: '1px solid #ccc', borderRadius: '4px' }}
                            placeholder="* * * * *"
                        />
                        <p style={{ marginTop: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                            Edit the Cron expression directly. Format: <code>Min Hour Day Month DayOfWeek</code>
                        </p>
                    </div>
                )}

                {/* Preview Footer */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ background: '#1e293b', color: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>{value}</code>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                        {mode === 'minute' && `Runs every ${minuteInterval} minutes`}
                        {mode === 'hourly' && `Runs at minute ${hourlyMinute} past every ${hourlyInterval} hour(s)`}
                        {mode === 'daily' && `Runs at ${time} (Local Time) every ${dailyInterval} day(s)`}
                        {mode === 'weekly' && `Runs at ${time} (Local Time) on selected days`}
                        {mode === 'monthly' && `Runs at ${time} (Local Time) on selected dates`}
                    </span>
                </div>
            </div>
        </div>
    );
}
