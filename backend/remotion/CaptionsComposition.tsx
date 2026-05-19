import React, { useEffect, useState } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo, delayRender, continueRender, spring, interpolate } from 'remotion';

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

    useEffect(() => {
        if (!styleOptions.fontFamily) {
            setFontLoaded(true);
            continueRender(handle);
            return;
        }

        const fontUrl = `http://127.0.0.1:${expressPort || 3005}/fonts/${encodeURIComponent(baseFont + '_v2.ttf')}`;
        const weights = ['normal', '400', '700', '800', '900']; 
        
        Promise.all(weights.map(weight => {
            const font = new FontFace(baseFont, `url(${fontUrl})`, { weight });
            return font.load().then(f => f);
        })).then((loadedFonts) => {
            loadedFonts.forEach(f => document.fonts.add(f));
            setFontLoaded(true);
            continueRender(handle);
        }).catch((err) => {
            console.error('Font failed:', fontUrl);
            setFontLoaded(true);
            continueRender(handle);
        });
    }, [baseFont, handle, styleOptions.fontWeight, expressPort]);

    const shadowOpacity = styleOptions?.shadowOpacity ?? 80;
    const bgOpacity = styleOptions?.bgOpacity ?? 0;
    const textOpacity = styleOptions?.textOpacity ?? 100;
    const previewHeight = styleOptions?.previewHeight || 1;
    const videoHeight = propVideoHeight || styleOptions?.videoHeight || 1280;
    const scaleRatio = videoHeight / previewHeight;
    const scaledFontSize = Math.floor((styleOptions?.fontSize ?? 40) * scaleRatio);
    const scaledPaddingY = Math.floor(8 * scaleRatio);
    const scaledPaddingX = Math.floor(10 * scaleRatio);
    const scaledStroke = Math.floor((styleOptions?.strokeSize ?? 1) * scaleRatio);
    const scaledShadow = Math.floor((styleOptions?.shadowSize ?? 2) * scaleRatio);
    
    const hasShadow = styleOptions?.hasShadow;
    const shadowColorHex = styleOptions?.shadowColor || '#000000';
    const shadowColorStr = `${shadowColorHex}${Math.floor(shadowOpacity / 100 * 255).toString(16).padStart(2, '0')}`;
    const textShadowValue = hasShadow ? `${scaledShadow}px ${scaledShadow}px 0px ${shadowColorStr}` : 'none';

    let blockScale = 1;
    let blockTranslateY = 0;
    const animType = styleOptions?.animation || 'none';

    if (activeCaption) {
        const startFrame = Math.round(activeCaption.start * fps);
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
        }
    }
    
    const posX = (styleOptions?.captionPosition?.x ?? 0) * scaleRatio;
    const posY = (styleOptions?.captionPosition?.y ?? 0) * scaleRatio;

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <OffthreadVideo 
                src={videoUrl} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                muted
            />
            
            {activeCaption && fontLoaded && (
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
                            fontFamily: displayFont,
                            fontSize: `${scaledFontSize}px`,
                            maxWidth: `${styleOptions?.containerWidth ?? 80}%`,
                            color: styleOptions?.textColor + Math.floor(textOpacity / 100 * 255).toString(16).padStart(2, '0'),
                            backgroundColor: styleOptions?.hasBackground 
                                ? `${styleOptions?.bgColor}${Math.floor(bgOpacity / 100 * 255).toString(16).padStart(2, '0')}` 
                                : 'transparent',
                            padding: `${scaledPaddingY}px ${scaledPaddingX}px`,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.2',
                            fontWeight: styleOptions?.fontWeight || 'bold',
                            WebkitTextStroke: styleOptions?.hasStroke 
                                ? `${scaledStroke}px ${styleOptions?.strokeColor}` 
                                : (() => {
                                    const isBold = (styleOptions?.fontWeight || '').includes('bold') || (parseInt(styleOptions?.fontWeight) >= 700);
                                    if (isBold) {
                                        const isJanna = (styleOptions?.fontFamily || '').toLowerCase().includes('janna');
                                        const strokeWidth = isJanna ? Math.max(0.7, scaledFontSize * 0.015) : Math.max(0.3, scaledFontSize * 0.005);
                                        return `${strokeWidth}px currentColor`;
                                    }
                                    return 'none';
                                })(),
                            paintOrder: 'stroke fill',
                            textShadow: textShadowValue,
                            direction: 'rtl',
                            transform: `translate(${posX}px, calc(${posY}px + ${blockTranslateY}px)) scale(${blockScale})`
                        }}
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5625em 0.625em' }}>
                             {activeCaption.text.split(' ').map((word: string, i: number, arr: string[]) => {
                                const isWordAnim = styleOptions?.animationMode === 'word' || styleOptions?.animationMode === 'highlight';
                                const duration = activeCaption.end - activeCaption.start;
                                const scaledDuration = duration / (styleOptions?.wordSpeedMultiplier ?? 1);
                                const wordStartTime = activeCaption.start + (i / arr.length) * scaledDuration;
                                const wordEndTime = activeCaption.start + ((i + 1) / arr.length) * scaledDuration;
                                
                                const isHighlighted = isWordAnim && (currentTime >= wordStartTime && currentTime <= wordEndTime);
                                const wordStartFrame = Math.round(wordStartTime * fps);
                                const wordEndFrame = Math.round(wordEndTime * fps);
                                
                                let wordScale = 1;
                                if (isWordAnim && frame >= wordStartFrame - 5 && frame <= wordEndFrame + 5) {
                                    if (frame >= wordStartFrame && frame < wordEndFrame) {
                                        wordScale = interpolate(frame - wordStartFrame, [0, 3], [1, 1.15], { extrapolateRight: 'clamp' });
                                    } else if (frame >= wordEndFrame) {
                                        wordScale = interpolate(frame - wordEndFrame, [0, 3], [1.15, 1], { extrapolateRight: 'clamp' });
                                    }
                                }

                                return (
                                    <span key={i} style={{
                                        display: 'inline-block',
                                        color: isHighlighted ? (styleOptions?.wordHighlightColor || '#3e81f6') : undefined,
                                        transform: wordScale !== 1 ? `scale(${wordScale})` : 'none',
                                    }}>
                                        {word}
                                    </span>
                                );
                            })}
                        </div>
                    </span>
                </div>
            )}
        </AbsoluteFill>
    );
};
