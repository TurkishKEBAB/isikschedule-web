'use client';

import { MouseEvent } from 'react';

interface TeacherLinkProps {
    teacher?: string | null;
    fallback?: string;
    className?: string;
    title?: string;
}

const buildTeacherSearchUrl = (teacher: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${teacher} site:isikun.edu.tr`)}`;

export default function TeacherLink({ teacher, fallback = '-', className = '', title }: TeacherLinkProps) {
    const name = teacher?.trim();
    if (!name) {
        return <span className={className}>{fallback}</span>;
    }

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
    };

    return (
        <a
            href={buildTeacherSearchUrl(name)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            title={title || name}
            className={`hover:underline ${className}`}
        >
            {name}
        </a>
    );
}
