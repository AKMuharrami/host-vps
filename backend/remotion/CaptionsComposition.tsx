import React, { useEffect, useState, useCallback } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Video, OffthreadVideo, delayRender, continueRender, spring, interpolate } from 'remotion';

const isArabicText = (text: string) => {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicPattern.test(text);
};

const scaleStyleValue = (val: string | number | undefined, scale: number): string | number | undefined => {
    if (val === undefined) return undefined;
    if (typeof val === 'number') return val * scale;
    const str = String(val);
    if (str.endsWith('px')) {
        const num = parseFloat(str);
        return `${Math.round(num * scale)}px`;
    }
    if (str.endsWith('rem')) {
        const num = parseFloat(str);
        return `${num * 16 * scale}px`;
    }
    if (str.includes('px')) {
        return str.replace(/(-?\d+(?:\.\d+)?)px/g, (_, n) => `${Math.round(parseFloat(n) * scale)}px`);
    }
    return val;
};

const scaleStyles = (style: React.CSSProperties | undefined, scale: number): React.CSSProperties => {
    if (!style) return {};
    const res: any = {};
    const keepKeys = new Set([
        'backgroundColor', 'background', 'color', 'fontWeight', 'textAlign', 
        'textTransform', 'fontFamily', 'alignItems', 'justifyContent', 
        'display', 'flexDirection', 'pointerEvents', 'zIndex', 'direction',
        'lineHeight', 'opacity', 'backdropFilter', 'transformOrigin',
        'fontStyle', 'borderStyle', 'borderLeftStyle', 'borderRightStyle'
    ]);
    for (const [key, val] of Object.entries(style)) {
        if (keepKeys.has(key)) {
            res[key] = val;
        } else {
            res[key] = scaleStyleValue(val as any, scale);
        }
    }
    return res;
};

// Map of template styles to inline CSS
const TITLE_TEMPLATE_STYLES: Record<string, {
    layoutType: string;
    container: React.CSSProperties;
    title: React.CSSProperties;
    subtitle: React.CSSProperties;
    subtitleContainer?: React.CSSProperties;
}> = {
    'glass-dark-ultra': {
        layoutType: 'no-box',
        container: { backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.2)', padding: '32px', borderRadius: '40px', textAlign: 'center', maxWidth: '90%', margin: '0 auto', boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.05)' },
        title: { fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: '1.2', textShadow: '0 10px 20px rgba(0,0,0,0.4)' },
        subtitle: { fontWeight: 'bold', color: '#22d3ee', letterSpacing: '0.3em', textTransform: 'uppercase', backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '8px 20px', borderRadius: '9999px', display: 'inline-block', backdropBlur: 'md', marginTop: '16px' }
    },
    'cyberpunk-neon-ultra': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#050505', border: '2px solid #22d3ee', padding: '24px', borderRadius: '12px', boxShadow: '0 0 25px rgba(34,211,238,0.4), 0 0 40px rgba(236,72,153,0.3)', textAlign: 'center', maxWidth: '90%', margin: '0 auto' },
        title: { fontWeight: 900, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', textShadow: '0 0 8px rgba(34,211,238,0.8)', lineHeight: '1.2' },
        subtitle: { fontWeight: 'bold', color: '#ec4899', letterSpacing: '0.2em', textTransform: 'uppercase', textShadow: '0 0 5px rgba(236,72,153,0.8)' },
        subtitleContainer: { backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(236,72,153,0.3)', padding: '6px 16px', borderRadius: '6px', marginTop: '8px', display: 'inline-block' }
    },
    'elegant-clean': {
        layoutType: 'no-box',
        container: { backgroundColor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', borderRadius: '32px', textAlign: 'center', maxWidth: '92%', margin: '0 auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
        title: { fontWeight: 500, color: 'white', letterSpacing: '-0.01em', lineHeight: '1.4', textShadow: '0 2px 10px rgba(0,0,0,0.2)' },
        subtitle: { fontWeight: 'bold', color: '#818cf8', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.2)', padding: '6px 16px', borderRadius: '9999px', display: 'inline-block', backdropBlur: 'md', marginTop: '12px' }
    },
    'viral-pop': {
        layoutType: 'split-cards',
        container: { background: 'linear-gradient(to top right, #facc15, #f59e0b, #fef08a)', padding: '24px', borderRadius: '24px', borderWidth: '3px', borderStyle: 'solid', borderColor: 'black', boxShadow: '6px 6px 0px rgba(0,0,0,1)', textAlign: 'center', maxWidth: '92%', margin: '0 auto', transform: 'rotate(-0.3deg)' },
        title: { fontWeight: 900, color: 'black', lineHeight: '1.2' },
        subtitle: { fontWeight: 900, color: '#fef08a', lineHeight: '1' },
        subtitleContainer: { backgroundColor: 'black', borderWidth: '2px', borderStyle: 'solid', borderColor: 'black', color: '#fef08a', padding: '4px 16px', borderRadius: '24px', boxShadow: '4px 4px 0px rgba(0,0,0,1)', transform: 'rotate(0.4deg)', display: 'inline-block' }
    },
    'hormozi-bolt': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#0D0D11', borderWidth: '3px', borderStyle: 'solid', borderColor: '#eab308', padding: '20px', borderRadius: '16px', boxShadow: '6px 6px 0px rgba(234,179,8,0.25)', textAlign: 'center', maxWidth: '90%', margin: '0 auto', transform: 'rotate(-0.4deg)' },
        title: { fontWeight: 900, color: '#eab308', letterSpacing: '0.05em', textTransform: 'uppercase', textShadow: '0 2px 4px rgba(0,0,0,0.8)', lineHeight: '1.2' },
        subtitle: { fontWeight: 800, color: '#34d399', lineHeight: '1', textTransform: 'uppercase', letterSpacing: '-0.02em' },
        subtitleContainer: { backgroundColor: '#0D0D11', borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(16, 185, 129, 0.3)', padding: '4px 14px', borderRadius: '12px', boxShadow: '4px 4px 0px rgba(16,185,129,0.15)', transform: 'rotate(0.3deg)', display: 'inline-block' }
    },
    'luxury-serif': {
        layoutType: 'split-cards',
        container: { background: 'linear-gradient(to bottom, #0c0a09, rgba(28, 25, 23, 0.95))', padding: '24px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 12px 40px rgba(245,158,11,0.12)', textAlign: 'center', maxWidth: '94%', margin: '0 auto' },
        title: { 
            fontWeight: 900, 
            fontFamily: 'Janna LT, sans-serif',
            backgroundImage: 'linear-gradient(to right, #fef3c7, #f59e0b, #fef3c7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)', 
            lineHeight: '1.6' 
        },
        subtitle: { fontWeight: 500, color: '#e7e5e4', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: '1' },
        subtitleContainer: { fontFamily: 'Janna LT, sans-serif', backgroundColor: 'rgba(69, 26, 3, 0.4)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '6px 12px', borderRadius: '8px', backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', display: 'inline-block' }
    },
    'fuji-modern': {
        layoutType: 'split-cards',
        container: { backgroundColor: 'rgba(30, 27, 75, 0.8)', backdropFilter: 'blur(24px)', border: '1px solid rgba(129, 140, 248, 0.2)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(99,102,241,0.15)', textAlign: 'center', maxWidth: '92%', margin: '0 auto' },
        title: { fontWeight: 800, color: 'white', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: '1.2', textShadow: '0 2px 10px rgba(0,0,0,0.5)' },
        subtitle: { fontWeight: 500, color: '#c7d2fe', lineHeight: '1' },
        subtitleContainer: { backgroundColor: 'rgba(217, 70, 239, 0.2)', border: '1px solid rgba(232, 121, 249, 0.2)', padding: '6px 14px', borderRadius: '9999px', display: 'inline-block', backdropFilter: 'blur(8px)', boxShadow: '0 5px 15px rgba(240,70,170,0.15)' }
    },
    'vintage-journal': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#fcf8f2', border: '2px solid rgba(28,25,23,0.1)', padding: '20px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', textAlign: 'right', maxWidth: '90%', margin: '0 auto' },
        title: { fontWeight: 800, color: '#1c1917', lineHeight: '1.6' },
        subtitle: { fontWeight: 'bold', color: '#854d0e', lineHeight: '1.2' },
        subtitleContainer: { backgroundColor: '#eedfcb', border: '1px solid rgba(28,25,23,0.05)', padding: '4px 12px', borderRadius: '6px', textAlign: 'right', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'inline-block' }
    },
    'vox-frame': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '12px', boxShadow: '0 15px 35px rgba(0,0,0,0.5)', textAlign: 'right', maxWidth: '92%', margin: '0 auto' },
        title: { fontWeight: 900, color: 'white', lineHeight: '1.4' },
        subtitle: { color: '#f97316', fontWeight: 800, lineHeight: '1', textTransform: 'uppercase', letterSpacing: '0.05em' },
        subtitleContainer: { backgroundColor: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.25)', padding: '4px 10px', borderRadius: '6px', display: 'inline-flex' }
    },
    'hyper-glow': {
        layoutType: 'split-cards',
        container: { backgroundColor: 'rgba(10, 10, 16, 0.95)', backdropFilter: 'blur(8px)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.3)', boxShadow: '0 0 25px rgba(99,102,241,0.25)', textAlign: 'center', maxWidth: '90%', margin: '0 auto' },
        title: { fontWeight: 800, color: 'white', letterSpacing: '0.05em', textTransform: 'uppercase', textShadow: '0 0 12px rgba(99,102,241,0.85)', lineHeight: '1.2' },
        subtitle: { fontWeight: 'bold', color: '#f472b6', lineHeight: '1' },
        subtitleContainer: { backgroundColor: 'rgba(29, 16, 46, 0.85)', border: '1px solid rgba(240, 70, 170, 0.2)', padding: '4px 12px', borderRadius: '8px', boxShadow: '0 0 15px rgba(240,70,170,0.2)', display: 'inline-block' }
    },
    'challenge-3d': {
        layoutType: 'split-cards',
        container: { background: 'linear-gradient(to top right, #ea580c, #f97316, #fb923c)', padding: '20px', borderRadius: '16px', border: '4px solid black', boxShadow: '5px 5px 0px rgba(0,0,0,1)', textAlign: 'center', maxWidth: '92%', margin: '0 auto', transform: 'rotate(-0.5deg)' },
        title: { fontWeight: 900, color: 'white', textTransform: 'uppercase', textShadow: '0 3px 0px rgba(0,0,0,1)', lineHeight: '1.2' },
        subtitle: { fontWeight: 800, color: '#fef08a', lineHeight: '1', textTransform: 'uppercase' },
        subtitleContainer: { backgroundColor: 'black', color: 'white', padding: '6px 12px', borderRadius: '4px', border: '2px solid black', transform: 'rotate(0.4deg)', boxShadow: '3px 3px 0px rgba(0,0,0,1)', display: 'inline-block' }
    },
    'neon-glow': {
        layoutType: 'split-cards',
        container: { backgroundColor: 'rgba(2, 6, 23, 0.9)', padding: '24px', borderRadius: '12px', border: '2px solid #22d3ee', boxShadow: '0 0 15px rgba(34,211,238,0.4), inset 0 0 10px rgba(236,72,153,0.2)', textAlign: 'center', maxWidth: '90%', margin: '0 auto' },
        title: { fontWeight: 800, color: '#22d3ee', textShadow: '0 0 8px rgba(34,211,238,0.7)', textTransform: 'uppercase', lineHeight: '1.2' },
        subtitle: { fontWeight: 900, color: '#ec4899', letterSpacing: '0.05em', textShadow: '0 0 6px rgba(236,72,153,0.7)' },
    },
    'tiktok-header': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#18181b', border: '1px solid #27272a', padding: '18px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '94%', margin: '0 auto' },
        title: { fontWeight: 900, color: 'white', lineHeight: '1.4' },
        subtitle: { color: '#22c55e', fontWeight: 'bold' },
        subtitleContainer: { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: '9999px', display: 'inline-flex' }
    },
    'podcast-ribbon': {
        layoutType: 'split-cards',
        container: { backgroundColor: 'rgba(127, 29, 29, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)', backdropFilter: 'blur(12px)', padding: '20px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center', maxWidth: '90%', margin: '0 auto' },
        title: { fontWeight: 'bold', color: 'white', textTransform: 'uppercase', lineHeight: '1.2' },
        subtitle: { color: '#fca5a5', fontWeight: 800 }
    },
    'minimal-outline': {
        layoutType: 'split-cards',
        container: { backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center', maxWidth: '95%', margin: '0 auto' },
        title: { fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.5)', lineHeight: '1.2' },
        subtitle: { fontWeight: 500, color: '#e7e5e4', letterSpacing: '0.05em', textShadow: '0 1.5px 2px rgba(0,0,0,0.5)' }
    },
    'breaking-news': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#991b1b', borderLeftWidth: '6px', borderLeftStyle: 'solid', borderLeftColor: '#facc15', padding: '20px', borderRadius: '0px', boxShadow: '2px 10px 35px rgba(0,0,0,0.45)', textAlign: 'right', maxWidth: '94%', margin: '0 auto' },
        title: { fontWeight: 900, color: 'white', lineHeight: '1.4', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },
        subtitle: { fontWeight: 900, color: '#facc15' },
        subtitleContainer: { backgroundColor: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }
    },
    'manga-action': {
        layoutType: 'split-cards',
        container: { background: 'linear-gradient(to top right, #ea580c, #f59e0b)', padding: '24px', borderRadius: '16px', border: '4px solid black', boxShadow: '5px 5px 0px rgba(0,0,0,1)', textAlign: 'center', maxWidth: '90%', margin: '0 auto', transform: 'rotate(-0.5deg)' },
        title: { fontWeight: 900, color: 'white', textTransform: 'uppercase', textShadow: '0 2.5px 0px rgba(0,0,0,1)', lineHeight: '1.2' },
        subtitle: { fontWeight: 'bold', color: '#facc15' },
        subtitleContainer: { backgroundColor: 'black', color: 'white', padding: '4px 10px', borderRadius: '6px', border: '2px solid black', display: 'inline-block' }
    },
    'retro-synthwave': {
        layoutType: 'split-cards',
        container: { background: 'linear-gradient(to bottom, #2e1065, #020617, #2e1065)', padding: '24px', borderRadius: '24px', border: '1px solid #d946ef', boxShadow: '0 0 20px rgba(240,46,170,0.25)', textAlign: 'center', maxWidth: '92%', margin: '0 auto' },
        title: { fontWeight: 800, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', textShadow: '0 1.5px 1px rgba(0,0,0,0.5)', lineHeight: '1.2' },
        subtitle: { fontWeight: 600, color: '#67e8f9', letterSpacing: '0.1em' }
    },
    'athletic-extreme': {
        layoutType: 'split-cards',
        container: { backgroundColor: '#1c1917', borderRightWidth: '6px', borderRightStyle: 'solid', borderRightColor: '#a3e635', padding: '20px', borderRadius: '0px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', textAlign: 'right', maxWidth: '90%', margin: '0 auto', transform: 'skewX(-2.5deg)' },
        title: { fontWeight: 900, color: '#a3e635', textTransform: 'uppercase', fontStyle: 'italic', lineHeight: '1.2' },
        subtitle: { fontWeight: 500, color: 'rgba(255,255,255,0.95)', fontStyle: 'italic' }
    }
};

// Simple implementation simulating the App.tsx styles
export const CaptionsComposition = ({
    videoUrl,
    captions,
    styleOptions,
    videoHeight: propVideoHeight,
    expressPort
}: any) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    useEffect(() => {
        // Logging removed for performance
    }, [frame, fps, currentTime, captions, styleOptions]);

    const [handle] = useState(() => delayRender('Loading fonts...'));
    const [fontLoaded, setFontLoaded] = useState(false);

    const activeCaption = Array.isArray(captions) 
        ? captions.find((c: any) => currentTime >= c.start && currentTime <= c.end)
        : null;

    const FONT_MAP: Record<string, string> = {
        'font-sans': 'Janna LT',
        'font-cairo': 'Cairo',
        'font-tajawal': 'Tajawal',
        'font-serif': 'Amiri',
        'font-roboto': 'Roboto',
        'font-amiri': 'Amiri',
        'font-ibm': 'IBM Plex Sans Arabic',
    };
    
    const baseFont = FONT_MAP[styleOptions.fontFamily] || styleOptions.fontFamily || 'Janna LT';
    const displayFont = `${baseFont}, sans-serif`;

    const coverFontRaw = styleOptions.coverFontFamily || 'template-default';
    const coverFont = coverFontRaw !== 'template-default'
        ? (FONT_MAP[styleOptions.coverFontFamily] || styleOptions.coverFontFamily || 'Janna LT')
        : undefined;
    const resolvedCoverFont = coverFont ? `${coverFont}, sans-serif` : undefined;

    useEffect(() => {
        if (!styleOptions.fontFamily) {
            setFontLoaded(true);
            continueRender(handle);
            return;
        }

        const fontsToLoad = [baseFont];
        if (styleOptions.showCoverTitle && coverFont !== baseFont) {
            fontsToLoad.push(coverFont);
        }

        const weights = ['normal', '400', '700', '800', '900'];

        const loadFont = async (name: string) => {
            const fontUrl = `http://127.0.0.1:${expressPort || 3005}/fonts/${encodeURIComponent(name + '_v2.ttf')}`;
            try {
                const loaded = await Promise.all(weights.map(async (weight) => {
                    const font = new FontFace(name, `url(${fontUrl})`, { weight });
                    const f = await font.load();
                    return f;
                }));
                loaded.forEach(f => document.fonts.add(f));
            } catch (err) {
                console.error('Failed to load font from local server:', fontUrl, err);
                // Fallback to Janna Regular if it fails and is Janna
                if (name.includes('Janna')) {
                    const fbFont = new FontFace(name, `url(https://hjrm8lbtnby37npy.public.blob.vercel-storage.com/Janna%20LT%20Regular.ttf)`, {
                        weight: 'normal'
                    });
                    try {
                        const loaded = await fbFont.load();
                        document.fonts.add(loaded);
                    } catch (fbErr) {
                        console.error('Failed to load fallback font:', fbErr);
                    }
                } else {
                    const familyName = name.replace(/ /g, '+');
                    const weight = styleOptions.fontWeight || '400';
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = `https://fonts.googleapis.com/css2?family=${familyName}:wght@${weight}&display=swap`;
                    await new Promise((resolve) => {
                        link.onload = () => { document.fonts.ready.then(() => resolve(null)); };
                        link.onerror = () => { resolve(null); };
                        document.head.appendChild(link);
                    });
                }
            }
        };

        Promise.all(fontsToLoad.map(loadFont)).finally(() => {
            setFontLoaded(true);
            continueRender(handle);
        });
    }, [baseFont, coverFont, handle, styleOptions.fontWeight, expressPort, styleOptions.showCoverTitle]);

    // Apply inline style logic from App.tsx
    const shadowOpacity = styleOptions?.shadowOpacity ?? 80;
    const bgOpacity = styleOptions?.bgOpacity ?? 85;
    const textOpacity = styleOptions?.textOpacity ?? 100;
    
    // Scale from preview container pixel space to source video pixel space
    const previewHeight = styleOptions?.previewHeight || 1;
    const videoHeight = propVideoHeight || styleOptions?.videoHeight || 1920;
    const scaleRatio = videoHeight / previewHeight;
    const scaledFontSize = Math.floor((styleOptions?.fontSize ?? 40) * scaleRatio);
    const scaledPaddingY = Math.floor(8 * scaleRatio);
    const scaledPaddingX = Math.floor(10 * scaleRatio);
    const scaledStroke = Math.floor((styleOptions?.strokeSize ?? 1) * scaleRatio);
    const scaledShadow = Math.floor((styleOptions?.shadowSize ?? 2) * scaleRatio);
    
    // Convert hex+opacity down if we want, or just rely on CSS
    const hasShadow = styleOptions?.hasShadow;
    const shadowSize = scaledShadow;
    const shadowColorHex = styleOptions?.shadowColor || '#000000';
    const shadowColorStr = `${shadowColorHex}${Math.floor(shadowOpacity / 100 * 255).toString(16).padStart(2, '0')}`;

    const shadows = [];
    if (styleOptions?.hasStroke && scaledStroke > 0) {
        const steps = 12;
        for (let i = 0; i < steps; i++) {
            const angle = (i * 2 * Math.PI) / steps;
            const dx = (Math.cos(angle) * scaledStroke).toFixed(1);
            const dy = (Math.sin(angle) * scaledStroke).toFixed(1);
            shadows.push(`${dx}px ${dy}px 0px ${styleOptions.strokeColor}`);
        }
    }
    
    if (hasShadow && shadowSize > 0) {
        shadows.push(`${shadowSize}px ${shadowSize}px ${shadowSize + 2}px ${shadowColorStr}`);
    }

    const textShadowValue = shadows.length > 0 ? shadows.join(', ') : 'none';

    const isArabic = isArabicText(activeCaption?.text || '');
    const direction = isArabic ? 'rtl' : 'ltr';

    // Animation Block
    let blockScale = 1;
    let blockTranslateY = 0;
    let blockOpacityVal = 1;
    
    // Fallback if not specified
    const animType = styleOptions?.animation || 'none';
    const animationMode = styleOptions?.animationMode || 'none';
    const isWordAnim = animationMode === 'word' || animationMode === 'highlight';
    const wordScaleMultiplier = styleOptions?.wordScaleMultiplier ?? 1.15;
    const inactiveWordOpacity = styleOptions?.inactiveWordOpacity ?? 100;
    const wordSpeedMultiplier = styleOptions?.wordSpeedMultiplier ?? 1;
    const useWordHighlightBg = styleOptions?.useWordHighlightBg ?? false;
    const wordHighlightBgColor = styleOptions?.wordHighlightBgColor ?? '#3e81f6';
    const wordHighlightColor = styleOptions?.wordHighlightColor ?? '#3e81f6';

    if (activeCaption) {
        const startFrame = Math.round(activeCaption.start * fps);
        const endFrame = Math.round(activeCaption.end * fps);
        // Only run animation on entrance
        const relativeFrame = frame - startFrame;
        
        if (animType === 'pop') {
            blockScale = spring({
                fps,
                frame: relativeFrame,
                config: { damping: 12, stiffness: 200 },
                from: 0.8,
                to: 1
              });
        } else if (animType === 'slideUp') {
            const yOffset = 20 * scaleRatio;
            blockTranslateY = interpolate(
                spring({ fps, frame: relativeFrame, config: { damping: 15, stiffness: 200 } }),
                [0, 1],
                [yOffset, 0]
            );
        } else if (animType === 'fadeIn' || animType === 'typewriter') {
            blockOpacityVal = interpolate(relativeFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
        }
    }
    
    const posX = (styleOptions?.captionPosition?.x ?? 0) * scaleRatio;
    const posY = (styleOptions?.captionPosition?.y ?? 0) * scaleRatio;
    
    // Check if the cover title is currently active
    const showCover = styleOptions?.showCoverTitle && currentTime <= (styleOptions?.coverDuration ?? 2.5);

    return (
        <AbsoluteFill style={{ backgroundColor: styleOptions?.captionsOnly ? 'transparent' : 'black' }}>
            {!styleOptions?.captionsOnly && (
                <OffthreadVideo 
                    src={videoUrl} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    muted
                />
            )}
            
            {activeCaption && fontLoaded && !showCover && (
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '30%',
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 40
                }}>
                    <span
                        style={{
                            display: 'inline-block',
                            textAlign: 'center',
                            paddingLeft: '1rem',
                            paddingRight: '1rem',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                            fontFamily: displayFont,
                            fontSize: `${scaledFontSize}px`,
                            maxWidth: `${styleOptions?.containerWidth ?? 80}%`,
                            letterSpacing: isArabic ? 'normal' : undefined,
                            color: styleOptions?.textColor + Math.floor(textOpacity / 100 * 255).toString(16).padStart(2, '0'),
                            backgroundColor: styleOptions?.hasBackground 
                                ? `${styleOptions?.bgColor}${Math.floor(bgOpacity / 100 * 255).toString(16).padStart(2, '0')}` 
                                : 'transparent',
                            borderRadius: '0px',
                            padding: `${scaledPaddingY}px ${scaledPaddingX}px`,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            borderColor: styleOptions?.hasBackground ? 'rgba(255,255,255,0.1)' : 'transparent',
                            lineHeight: '1.2',
                            fontWeight: styleOptions?.fontWeight || 'bold',
                            textShadow: textShadowValue,
                            direction: direction as any,
                            transform: `translate(${posX}px, calc(${posY}px + ${blockTranslateY}px)) scale(${blockScale})`,
                            opacity: blockOpacityVal
                        }}
                        dir={direction}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                flexShrink: 0,
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingTop: '0.25rem',
                                paddingBottom: '0.25rem',
                                width: '100%',
                                gap: '1.5625em 0.625em'
                            }}
                        >
                             {activeCaption.text.split(' ').map((word: string, i: number, arr: string[]) => {
                                const duration = activeCaption.end - activeCaption.start;
                                const wordObj = activeCaption.words?.[i];
                                
                                const actualStart = wordObj ? wordObj.start : (activeCaption.start + (i / arr.length) * duration);
                                const actualEnd = wordObj ? wordObj.end : (activeCaption.start + ((i + 1) / arr.length) * duration);

                                const startOffset = actualStart - activeCaption.start;
                                const endOffset = actualEnd - activeCaption.start;
                                const speedMultiplier = wordSpeedMultiplier;

                                const SYNC_OFFSET = 0.08;
                                const wordStartTime = Math.max(0, activeCaption.start + (startOffset / speedMultiplier) - SYNC_OFFSET);
                                const wordEndTime = Math.max(0, activeCaption.start + (endOffset / speedMultiplier) - SYNC_OFFSET);
                                
                                const wordStartFrame = Math.round(wordStartTime * fps);
                                const wordEndFrame = Math.round(wordEndTime * fps);
                                
                                const isHighlighted = isWordAnim && (currentTime >= wordStartTime && currentTime <= wordEndTime);
                                
                                // Optimization: Only apply heavy transforms during active range
                                const isActive = frame >= wordStartFrame - 5 && frame <= wordEndFrame + 5;
 
                                let wordScale = 1;
                                if (isWordAnim && isActive) {
                                    if (frame >= wordStartFrame && frame < wordEndFrame) {
                                            wordScale = interpolate(
                                            frame - wordStartFrame,
                                            [0, 3], // small 3 frame pop
                                            [1, wordScaleMultiplier],
                                            { extrapolateRight: 'clamp' }
                                        );
                                    } else if (frame >= wordEndFrame) {
                                            wordScale = interpolate(
                                            frame - wordEndFrame,
                                            [0, 3], // 3 frame contract
                                            [wordScaleMultiplier, 1],
                                            { extrapolateRight: 'clamp' }
                                        );
                                    }
                                }
                                
                                let wordOpacity = 1;

                                if (animType === 'typewriter') {
                                    wordOpacity = interpolate(frame, [wordStartFrame, wordStartFrame + 5], [0, 1], { extrapolateRight: 'clamp' });
                                } else {
                                    wordOpacity = (!isWordAnim || isHighlighted) ? 1 : (inactiveWordOpacity / 100);
                                }

                                const isHighlightedBg = isHighlighted && useWordHighlightBg;
 
                                return (
                                    <span
                                        key={i}
                                        style={{
                                            display: 'inline-block',
                                            fontWeight: styleOptions?.fontWeight || 'normal',
                                            color: isHighlighted 
                                                ? (useWordHighlightBg ? '#ffffff' : wordHighlightColor) 
                                                : undefined,
                                            transform: wordScale !== 1 ? `scale(${wordScale})` : 'none',
                                            opacity: wordOpacity,
                                            transformOrigin: 'center',
                                            backgroundColor: isHighlightedBg ? wordHighlightBgColor : 'transparent',
                                            borderRadius: isHighlightedBg ? `${12 * scaleRatio}px` : '0px',
                                            padding: isHighlightedBg ? `${4 * scaleRatio}px ${10 * scaleRatio}px` : '0px',
                                            margin: isHighlightedBg ? `0 ${-1 * scaleRatio}px` : '0',
                                            transition: 'background-color 0.05s, color 0.05s'
                                        }}
                                    >
                                        {word}
                                    </span>
                                );
                            })}
                        </div>
                    </span>
                </div>
            )}

            {showCover && fontLoaded && (
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    backgroundColor: 'rgba(0,0,0,0.20)',
                    pointerEvents: 'none',
                    zIndex: 50
                }}>
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        top: '15%'
                    }}>
                        {(() => {
                            const tmplId = styleOptions?.selectedTitleTemplate || 'viral-pop';
                            const template = TITLE_TEMPLATE_STYLES[tmplId] || TITLE_TEMPLATE_STYLES['viral-pop'];
                            const layoutType = template.layoutType;
                            
                            const isArabicTitle = isArabicText(styleOptions?.coverTitle || '');
                            const isArabicSub = isArabicText(styleOptions?.coverSubtitle || '');
                            
                            const titleFontSizeMultiplier = styleOptions?.titleFontSizeMultiplier ?? 1.4;
                            const titleBgHeightMultiplier = styleOptions?.titleBgHeightMultiplier ?? 1;
                            const subtitleSizeMultiplier = styleOptions?.subtitleSizeMultiplier ?? 1.4;
                            const brushColor = styleOptions?.brushColor ?? '#facc15';
                            
                            // Scale dimensions based on videoHeight scaleRatio
                            const baseTitleSize = tmplId === 'elegant-clean' ? 20 : 17;
                            const scaledTitleFontSize = Math.floor(baseTitleSize * scaleRatio * titleFontSizeMultiplier);
                            const scaledSubtitleFontSize = Math.floor(10 * scaleRatio);
                            
                            const scaledContainer = scaleStyles(template.container, scaleRatio);
                            const scaledTitle = scaleStyles(template.title, scaleRatio);
                            const scaledSubtitle = scaleStyles(template.subtitle, scaleRatio);
                            const scaledSubtitleContainer = template.subtitleContainer 
                                ? scaleStyles(template.subtitleContainer, scaleRatio) 
                                : {
                                    backgroundColor: 'rgba(17, 17, 21, 0.95)',
                                    border: `${Math.round(1 * scaleRatio)}px solid rgba(255, 255, 255, 0.1)`,
                                    padding: `${6 * scaleRatio}px ${14 * scaleRatio}px`,
                                    borderRadius: `${9999 * scaleRatio}px`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                };

                            const customStyles: React.CSSProperties = {
                                fontFamily: resolvedCoverFont,
                                lineHeight: '1.4',
                                padding: '0.1em 0.2em',
                                fontSize: `${scaledTitleFontSize}px`,
                                direction: isArabicTitle ? 'rtl' : 'ltr',
                                textAlign: 'center',
                                margin: 0
                            };
                            
                            const mergedTitleStyle = { ...scaledTitle, ...customStyles };
                            
                            if (tmplId === 'retro-synthwave') {
                                mergedTitleStyle.backgroundImage = 'linear-gradient(to right, #facc15, #ec4899, #22d3ee)';
                                mergedTitleStyle.WebkitBackgroundClip = 'text';
                                (mergedTitleStyle as any).WebkitTextFillColor = 'transparent';
                             }
                             
                             const titleEl = (
                                 <h2 style={mergedTitleStyle}>
                                     {styleOptions?.coverTitle || ''}
                                 </h2>
                             );
                             
                             const subtitleEl = styleOptions?.coverSubtitle ? (
                                 <p style={{
                                     ...scaledSubtitle,
                                     fontFamily: resolvedCoverFont,
                                     lineHeight: '1.3',
                                     fontSize: `${scaledSubtitleFontSize}px`,
                                     direction: isArabicSub ? 'rtl' : 'ltr',
                                     margin: 0
                                 }}>
                                     {styleOptions?.coverSubtitle}
                                 </p>
                             ) : null;
                             
                             if (layoutType === 'no-box') {
                                 return (
                                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: `${4 * scaleRatio}px`, maxWidth: '95%', margin: '0 auto', padding: `${8 * scaleRatio}px 0` }}>
                                         <div>
                                             {titleEl}
                                         </div>
                                         {subtitleEl && (
                                             <div style={{
                                                 transform: `scale(${subtitleSizeMultiplier})`,
                                                 transformOrigin: 'center top',
                                                 marginTop: `${2 * scaleRatio}px`,
                                                 opacity: 0.95
                                             }}>
                                                 {subtitleEl}
                                             </div>
                                         )}
                                     </div>
                                 );
                             }
                             
                             return (
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: `${4 * scaleRatio}px`, width: '100%', maxWidth: '95%', margin: '0 auto' }}>
                                     <div style={{
                                         ...scaledContainer,
                                         paddingTop: `${titleBgHeightMultiplier * 1.25 * 16 * scaleRatio}px`,
                                         paddingBottom: `${titleBgHeightMultiplier * 1.25 * 16 * scaleRatio}px`,
                                     }}>
                                         {tmplId === 'podcast-ribbon' && (
                                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${6 * scaleRatio}px`, marginBottom: `${8 * scaleRatio}px`, position: 'relative' }}>
                                                 <span style={{ width: `${8 * scaleRatio}px`, height: `${8 * scaleRatio}px`, backgroundColor: '#dc2626', borderRadius: '50%', display: 'inline-block' }} />
                                                 <span style={{ fontSize: `${10 * scaleRatio}px`, fontWeight: 900, color: '#fca5a5', letterSpacing: '0.1em' }}>
                                                     🔴 LIVE ON AIR
                                                 </span>
                                             </div>
                                         )}
                                         {titleEl}
                                     </div>
                                     {subtitleEl && (
                                         <div style={{
                                             ...scaledSubtitleContainer,
                                             transform: `scale(${subtitleSizeMultiplier * 0.95})`,
                                             transformOrigin: 'center top',
                                             marginTop: `${2 * scaleRatio}px`
                                         }}>
                                             {subtitleEl}
                                         </div>
                                     )}
                                 </div>
                             );
                        })()}
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};
