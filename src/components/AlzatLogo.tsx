import React from 'react';
import AlzatLogoIcon from './AlzatLogoIcon';

interface AlzatLogoProps {
    layout?: 'horizontal' | 'vertical';
    size?: 'sm' | 'md' | 'lg';
}

const AlzatLogo = ({ layout = 'horizontal', size = 'md' }: AlzatLogoProps) => {
    const sizes = {
        sm: { icon: 'h-6', text: 'text-base', subtext: 'text-[8px]' },
        md: { icon: 'h-8', text: 'text-lg', subtext: 'text-[10px]' },
        lg: { icon: 'h-10', text: 'text-2xl', subtext: 'text-xs' },
    };

    const currentSize = sizes[size];

    const logoText = (
        <div>
            <span className={`${currentSize.text} font-bold tracking-wide text-brand-orange`}>ALZATO<sup className="text-[60%] font-light top-[-0.7em]">®</sup></span>
            <p className={`${currentSize.subtext} font-semibold text-brand-navy tracking-wide`}>OVERSEAS EDUCATION</p>
        </div>
    );

    if (layout === 'vertical') {
        return (
            <div className="flex flex-col items-center">
                <AlzatLogoIcon className={currentSize.icon} />
                <div className="mt-4 text-center">
                    {logoText}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <AlzatLogoIcon className={currentSize.icon} />
            {logoText}
        </div>
    );
};

export default AlzatLogo;
