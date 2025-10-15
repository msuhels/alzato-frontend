import React from 'react';

const AlzatLogoIcon = ({ className }: { className?: string }) => (
    <div className={`flex-shrink-0 ${className}`}>
        <svg viewBox="0 0 100 55" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
            <g clipPath="url(#clip0_alzat_new)">
                <rect width="100" height="55" fill="#F97316"/>
                <path d="M25 0L75 55" stroke="white" strokeWidth="10"/>
                <path d="M-5 15L15 -5" stroke="white" strokeWidth="3"/>
                <path d="M-5 25L25 -5" stroke="white" strokeWidth="3"/>
                <path d="M-5 35L35 -5" stroke="white" strokeWidth="3"/>
                <path d="M65 60L105 20" stroke="white" strokeWidth="3"/>
                <path d="M75 60L105 30" stroke="white" strokeWidth="3"/>
                <path d="M85 60L105 40" stroke="white" strokeWidth="3"/>
            </g>
            <defs>
                <clipPath id="clip0_alzat_new">
                    <rect width="100" height="55" fill="white"/>
                </clipPath>
            </defs>
        </svg>
    </div>
);

export default AlzatLogoIcon;
