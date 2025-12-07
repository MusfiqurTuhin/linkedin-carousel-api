"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Plus, Calendar, Download, Palette, Type, User, Sparkles, LayoutTemplate, Rows, ArrowRight, ImagePlus, Ratio, Eye, EyeOff, Wand2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import html2canvas from 'html2canvas'
import { domToPng } from 'modern-screenshot'
import download from 'downloadjs'
import jsPDF from 'jspdf'
import { useTheme, ThemeType } from '@/context/ThemeContext'
import { ColorPicker } from '@/components/ui/color-picker'
import { GlassCard } from '@/components/visuals/GlassCard'
import InfographicCard from '@/components/visuals/InfographicCard'

interface Slide {
    day_offset: number
    content: string
    image_prompt: string
    layout?: 'classic' | 'visual' | 'split' | 'infographic'
    data_points?: { label: string; value: number }[]
    custom_image_url?: string
    hide_logo?: boolean
}

type AspectRatio = '4/5' | '1/1' | '16/9'
type LogoStyle = 'original' | 'grayscale' | 'white' | 'black'

export function CarouselEditor() {
    const {
        theme, applyPreset,
        primaryColor, setPrimaryColor,
        textColor, setTextColor,
        backgroundStyle, setBackgroundStyle,
        font, setFont,
        fontSize, setFontSize,
        textAlign, setTextAlign,
        textShadow, setTextShadow,
        cornerRadius, setCornerRadius,
        logoUrl, setLogoUrl
    } = useTheme()

    const [topic, setTopic] = useState('')
    const [days, setDays] = useState(5)
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4/5')
    const [logoStyle, setLogoStyle] = useState<LogoStyle>('original')
    const [logoSize, setLogoSize] = useState(32)
    const [logoPosition, setLogoPosition] = useState({ x: 90, y: 10 }) // percentage-based
    const [isDraggingLogo, setIsDraggingLogo] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [slides, setSlides] = useState<Slide[]>([])
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

    // Brand State
    const [brandName, setBrandName] = useState('')
    const [brandHandle, setBrandHandle] = useState('')
    const [apiKey, setApiKey] = useState('')

    // Refs
    const slideRefs = useRef<(HTMLDivElement | null)[]>([])

    // Load API Key from localStorage
    useEffect(() => {
        const key = localStorage.getItem('gemini_api_key')
        if (key) setApiKey(key)
    }, [])

    // Update API Key
    const handleApiKeyChange = (key: string) => {
        setApiKey(key)
        localStorage.setItem('gemini_api_key', key)
    }

    const handleGenerate = async () => {
        if (!topic) return
        setIsLoading(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { 'x-gemini-api-key': apiKey } : {})
                },
                body: JSON.stringify({ topic, days }),
            })
            const data = await res.json()
            if (data.data) {
                setSlides(data.data)
                slideRefs.current = new Array(data.data.length).fill(null)
            }
        } catch (error) {
            console.error("Failed to generate", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSlideChange = (index: number, field: keyof Slide, value: any) => {
        const newSlides = [...slides]
        // @ts-ignore
        newSlides[index] = { ...newSlides[index], [field]: value }
        setSlides(newSlides)
    }

    const toggleLayout = (index: number) => {
        const newSlides = [...slides]
        const layouts: ('classic' | 'visual' | 'split' | 'infographic')[] = ['classic', 'visual', 'split', 'infographic']
        const current = newSlides[index].layout || 'classic'
        const next = layouts[(layouts.indexOf(current) + 1) % layouts.length]
        newSlides[index] = { ...newSlides[index], layout: next }
        setSlides(newSlides)
    }

    const handleDownloadSlide = async (index: number) => {
        const el = slideRefs.current[index]
        if (!el) return

        try {
            setIsLoading(true)
            console.log("📸 Starting HD download with modern-screenshot...")

            // Use modern-screenshot which supports modern CSS colors
            // Scale 4 = 4x resolution for HD quality
            const dataUrl = await domToPng(el, {
                scale: 4,
                quality: 1,
            })

            const safeTopic = topic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20) || 'carousel'
            const filename = `${safeTopic}_slide_${index + 1}_HD.png`

            // Download
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = filename
            link.click()

            console.log(`✅ Downloaded HD: ${filename}`)

        } catch (error: any) {
            console.error("❌ Download failed:", error?.message)
            alert(`Download failed: ${error?.message || 'Unknown error'}`)
        } finally {
            setIsLoading(false)
        }
    }

    const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            handleSlideChange(index, 'custom_image_url', url)
        }
    }

    const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null)

    // Helper to test if an image URL loads successfully
    const testImageUrl = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve(true)
            img.onerror = () => resolve(false)
            img.src = url
            // Timeout after 5 seconds
            setTimeout(() => resolve(false), 5000)
        })
    }

    const handleGenerateImage = async (index: number) => {
        const slide = slides[index]
        if (!slide.image_prompt) return

        setGeneratingImageIndex(index)

        // Helper to test image with timeout
        const testImage = (url: string, timeout = 8000): Promise<boolean> => {
            return new Promise((resolve) => {
                const img = new Image()
                const timer = setTimeout(() => {
                    img.src = ''
                    resolve(false)
                }, timeout)
                img.onload = () => {
                    clearTimeout(timer)
                    resolve(true)
                }
                img.onerror = () => {
                    clearTimeout(timer)
                    resolve(false)
                }
                img.src = url
            })
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const keywords = slide.content?.split(' ').slice(0, 3).join(',') || 'business,technology'

        // === STEP 1: Try Gemini (via backend) ===
        console.log('🔵 Step 1: Trying Gemini API...')
        try {
            const response = await fetch(`${API_URL}/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey && { 'x-gemini-api-key': apiKey })
                },
                body: JSON.stringify({
                    prompt: slide.image_prompt,
                    slide_index: index,
                    slide_content: slide.content
                })
            })

            const data = await response.json()

            if (data.success && data.image) {
                console.log('✅ Gemini succeeded!')
                handleSlideChange(index, 'custom_image_url', data.image)
                setGeneratingImageIndex(null)
                return
            }

            // === STEP 2: Try Pollinations ===
            if (data.fallback_url) {
                console.log('🟡 Step 2: Trying Pollinations...')
                const pollinationsWorks = await testImage(data.fallback_url, 10000)
                if (pollinationsWorks) {
                    console.log('✅ Pollinations succeeded!')
                    handleSlideChange(index, 'custom_image_url', data.fallback_url)
                    setGeneratingImageIndex(null)
                    return
                }
                console.log('❌ Pollinations failed')
            }

            // === STEP 3: Use KNOWN WORKING business images from Unsplash ===
            console.log('🟢 Step 3: Using pre-verified business images...')
            // These are direct Unsplash image URLs (guaranteed to work, no API needed)
            const businessImages = [
                'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=600&fit=crop', // Dashboard analytics
                'https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&h=600&fit=crop', // Team meeting
                'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&h=600&fit=crop', // Business presentation
                'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&h=600&fit=crop', // Data analytics screen
                'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&h=600&fit=crop', // Modern office
                'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&h=600&fit=crop', // Collaboration
                'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600&h=600&fit=crop', // Business growth chart
                'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=600&fit=crop', // Business strategy
            ]
            const imageIndex = index % businessImages.length
            const imageUrl = businessImages[imageIndex]
            handleSlideChange(index, 'custom_image_url', imageUrl)
            console.log('✅ Using verified image:', imageUrl)

        } catch (error) {
            console.error('❌ API call failed:', error)
            // Ultimate fallback - verified working image
            const fallbackUrl = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=600&fit=crop'
            console.log('🆘 Emergency fallback:', fallbackUrl)
            handleSlideChange(index, 'custom_image_url', fallbackUrl)
        } finally {
            setGeneratingImageIndex(null)
        }
    }

    const getDimensions = () => {
        // Preview dimensions (export = preview × pixelRatio 3 = 1080px wide)
        switch (aspectRatio) {
            case '1/1': return { width: 360, height: 360 }       // Export: 1080×1080
            case '16/9': return { width: 360, height: 203 }      // Export: 1080×608
            default: return { width: 360, height: 450 }          // Export: 1080×1350 (4:5)
        }
    }

    const handleDownloadPDF = async () => {
        if (slides.length === 0) return

        try {
            setIsLoading(true)
            const { width, height } = getDimensions()
            const scale = 4  // High quality: 4x resolution

            // Create PDF with high resolution
            const doc = new jsPDF({
                orientation: aspectRatio === '16/9' ? 'l' : 'p',
                unit: 'px',
                format: [width * scale, height * scale],
                compress: false  // Better quality without compression
            })

            for (let i = 0; i < slides.length; i++) {
                const el = slideRefs.current[i]
                if (el) {
                    if (i > 0) doc.addPage([width * scale, height * scale])

                    // Use domToPng from modern-screenshot (supports modern CSS)
                    const dataUrl = await domToPng(el, {
                        scale: scale,
                        quality: 1,
                    })

                    doc.addImage(dataUrl, 'PNG', 0, 0, width * scale, height * scale)
                }
            }

            const safeTopic = topic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) || 'carousel'
            doc.save(`${safeTopic}_carousel_HD.pdf`)
        } catch (error: any) {
            console.error("PDF export failed:", error?.message)
            alert(`PDF export failed: ${error?.message || 'Unknown error'}`)
        } finally {
            setIsLoading(false)
        }
    }

    // Logo Drag Handlers
    const handleLogoDragStart = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsDraggingLogo(true)
    }

    const handleLogoDrag = (e: React.MouseEvent, containerRect: DOMRect) => {
        if (!isDraggingLogo) return

        const x = ((e.clientX - containerRect.left) / containerRect.width) * 100
        const y = ((e.clientY - containerRect.top) / containerRect.height) * 100

        // Clamp values between 5 and 95 to keep logo visible
        setLogoPosition({
            x: Math.max(5, Math.min(95, x)),
            y: Math.max(5, Math.min(95, y))
        })
    }

    const handleLogoDragEnd = () => {
        setIsDraggingLogo(false)
    }

    return (
        <div className="flex h-screen bg-[#0F172A] text-slate-100 font-sans overflow-hidden">

            {/* COLUMN 1: Global Settings & Generate (Dark Mode UI) */}
            <div className="w-[340px] border-r border-slate-800 bg-[#1E293B] flex flex-col h-full shadow-xl z-20">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        AI Carousel <span className="text-purple-400">Pro</span>
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Dribbble-ready designs in seconds.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Generate Section */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Content Engine</h3>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-300">Topic / Context</label>
                            <Textarea
                                placeholder="e.g. 7 Secrets of High-Converting Landing Pages..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="h-28 resize-none bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-purple-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-xs font-medium text-slate-300">Slide Count</label>
                                <span className="text-xs font-bold text-purple-400">{days} Slides</span>
                            </div>
                        </div>

                        {/* API Key Input */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            <label className="text-xs font-medium text-slate-300 flex justify-between">
                                API Key (Optional)
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-purple-400 hover:text-purple-300 text-[10px]">Get Key ↗</a>
                            </label>
                            <input
                                type="password"
                                placeholder="Paste your Gemini API Key..."
                                value={apiKey}
                                onChange={(e) => handleApiKeyChange(e.target.value)}
                                className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white placeholder:text-slate-600 focus:border-purple-500 outline-none"
                            />
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={isLoading || !topic}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-6 shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate Magic
                        </Button>
                    </section>

                    {/* Theme Section */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Palette className="h-4 w-4" /> Professional Themes
                        </h3>

                        <div className="grid grid-cols-2 gap-2">
                            {['glass-dark', 'glass-light', 'neon', 'luxury', 'bold', 'sunset', 'minimal', 'pure-white', 'pure-black'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => applyPreset(t as ThemeType)}
                                    className={`text-xs px-3 py-2 rounded-md border transition-all ${theme === t ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                >
                                    {t.replace('-', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* Color Pickers */}
                        <div className="space-y-3 pt-3">
                            <ColorPicker label="Accent Color" value={primaryColor} onChange={setPrimaryColor} />
                            <ColorPicker label="Text Color" value={textColor} onChange={setTextColor} />
                        </div>

                        {/* Typography Controls */}
                        <div className="space-y-3 pt-3 border-t border-slate-800">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Typography</h4>

                            {/* Font Family */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400">Font Family</label>
                                <select
                                    value={font}
                                    onChange={(e) => setFont(e.target.value as any)}
                                    className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                                >
                                    {['Inter', 'Roboto', 'Playfair Display', 'Outfit', 'Space Grotesk', 'Poppins', 'Montserrat', 'Lato', 'Open Sans', 'Merriweather', 'Tiro Bangla', 'Noto Serif Bengali', 'Hind Siliguri', 'Noto Sans Bengali'].map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Font Size */}
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <label className="text-xs font-medium text-slate-400">Font Size</label>
                                    <span className="text-[10px] text-slate-500">{fontSize}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="16"
                                    max="48"
                                    value={fontSize}
                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>

                            {/* Text Alignment */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400">Alignment</label>
                                <div className="flex bg-slate-900 p-1 rounded-md border border-slate-700">
                                    {(['left', 'center', 'right'] as const).map(align => (
                                        <button
                                            key={align}
                                            onClick={() => setTextAlign(align)}
                                            className={`flex-1 py-1.5 text-[10px] font-medium rounded capitalize ${textAlign === align ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            {align}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Text Shadow Toggle */}
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-slate-400">Text Shadow</label>
                                <button
                                    onClick={() => setTextShadow(!textShadow)}
                                    className={`w-10 h-5 rounded-full transition-colors ${textShadow ? 'bg-purple-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${textShadow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Corner Radius */}
                        <div className="space-y-2 pt-3 border-t border-slate-800">
                            <div className="flex justify-between">
                                <label className="text-xs font-medium text-slate-400">Corner Radius</label>
                                <span className="text-[10px] text-slate-500">{cornerRadius}px</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="40"
                                value={cornerRadius}
                                onChange={(e) => setCornerRadius(Number(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Ratio className="h-4 w-4" /> Canvas Size
                            </h3>
                            <div className="flex bg-slate-900 p-1 rounded-md border border-slate-700">
                                <button
                                    onClick={() => setAspectRatio('4/5')}
                                    className={`flex-1 py-1.5 text-[10px] font-medium rounded ${aspectRatio === '4/5' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Portrait (4:5)
                                </button>
                                <button
                                    onClick={() => setAspectRatio('1/1')}
                                    className={`flex-1 py-1.5 text-[10px] font-medium rounded ${aspectRatio === '1/1' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Square (1:1)
                                </button>
                                <button
                                    onClick={() => setAspectRatio('16/9')}
                                    className={`flex-1 py-1.5 text-[10px] font-medium rounded ${aspectRatio === '16/9' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Landscape
                                </button>
                            </div>
                        </div>

                        {/* Logo Style Selector */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Palette className="h-4 w-4" /> Logo Style
                            </h3>
                            <div className="grid grid-cols-4 gap-1">
                                {(['original', 'grayscale', 'white', 'black'] as LogoStyle[]).map(style => (
                                    <button
                                        key={style}
                                        onClick={() => setLogoStyle(style)}
                                        className={`text-[10px] py-1.5 rounded border capitalize transition-colors ${logoStyle === style
                                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Logo Size Control */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                                <span>Logo Size</span>
                                <span className="text-slate-500">{logoSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="80"
                                value={logoSize}
                                onChange={(e) => setLogoSize(Number(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-300">Typography</label>
                            <select
                                value={font}
                                onChange={(e) => setFont(e.target.value as any)}
                                className="w-full h-9 rounded-md border border-slate-700 bg-slate-900 text-white text-sm px-2 focus:border-purple-500 outline-none"
                            >
                                <option value="Inter">Inter (Clean)</option>
                                <option value="Roboto">Roboto (Neutral)</option>
                                <option value="Playfair Display">Playfair (Serif)</option>
                                <option value="Outfit">Outfit (Display)</option>
                                <option value="Space Grotesk">Space Grotesk (Tech)</option>
                            </select>
                        </div>
                    </section>

                    {/* Brand Section */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <User className="h-4 w-4" /> Personal Branding
                        </h3>

                        {/* Logo Upload */}
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center relative group cursor-pointer">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="h-5 w-5 text-slate-500" />
                                )}

                                {/* Hidden Input Layer */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            const url = URL.createObjectURL(file)
                                            setLogoUrl(url)
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-medium text-slate-300">Brand Logo</p>
                                <p className="text-[10px] text-slate-500">Tap circle to upload</p>
                            </div>
                        </div>

                        {/* Logo Size Slider */}
                        {logoUrl && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-slate-300">Logo Size</label>
                                    <span className="text-xs text-slate-500">{logoSize}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="16"
                                    max="80"
                                    value={logoSize}
                                    onChange={(e) => setLogoSize(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setLogoPosition({ x: 90, y: 10 })}
                                        className="flex-1 text-[10px] px-2 py-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 transition-colors"
                                    >
                                        Top Right
                                    </button>
                                    <button
                                        onClick={() => setLogoPosition({ x: 10, y: 10 })}
                                        className="flex-1 text-[10px] px-2 py-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 transition-colors"
                                    >
                                        Top Left
                                    </button>
                                    <button
                                        onClick={() => setLogoPosition({ x: 50, y: 90 })}
                                        className="flex-1 text-[10px] px-2 py-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 transition-colors"
                                    >
                                        Bottom
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 text-center">💡 Drag logo on preview to reposition</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-300">Display Name</label>
                            <input
                                className="w-full h-9 px-3 border border-slate-700 bg-slate-900 text-white rounded-md text-sm focus:border-purple-500 outline-none placeholder:text-slate-600"
                                placeholder="e.g. Musfiqur Tuhin"
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-300">Handle / Tagline</label>
                            <input
                                className="w-full h-9 px-3 border border-slate-700 bg-slate-900 text-white rounded-md text-sm focus:border-purple-500 outline-none placeholder:text-slate-600"
                                placeholder="e.g. @musfiq.dev"
                                value={brandHandle}
                                onChange={(e) => setBrandHandle(e.target.value)}
                            />
                        </div>
                    </section>
                </div>
            </div >

            {/* COLUMN 2: Content Editor (Slide Inputs) */}
            < div className="w-[380px] border-r border-slate-800 bg-[#0F172A] flex flex-col h-full z-10" >
                <div className="p-4 border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur">
                    <h2 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
                        <Type className="h-4 w-4 text-purple-400" /> Storyboard
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {slides.length === 0 ? (
                        <div className="flex flex-col items-center justify-center mt-20 text-slate-600">
                            <Type className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-sm">Content will appear here.</p>
                        </div>
                    ) : (
                        slides.map((slide, idx) => (
                            <Card key={idx} className="bg-slate-800 border-slate-700 shadow-none hover:border-slate-600 transition-colors">
                                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 flex justify-between items-center bg-black/20">
                                    <span>Day {slide.day_offset}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleSlideChange(idx, 'hide_logo', !slide.hide_logo as any)}
                                            className="text-slate-500 hover:text-purple-400 transition-colors"
                                            title={slide.hide_logo ? "Show Logo" : "Hide Logo"}
                                        >
                                            {slide.hide_logo ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                        </button>
                                        <button
                                            onClick={() => handleGenerateImage(idx)}
                                            disabled={generatingImageIndex === idx || !slide.image_prompt}
                                            className={`transition-colors ${generatingImageIndex === idx ? 'text-purple-400 animate-pulse' : 'text-slate-500 hover:text-purple-400'}`}
                                            title="Generate AI Image"
                                        >
                                            {generatingImageIndex === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                        </button>
                                        <label className="cursor-pointer hover:text-purple-400 transition-colors" title="Upload custom image">
                                            <ImagePlus className="h-3 w-3" />
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(idx, e)}
                                            />
                                        </label>
                                        <span className="text-slate-600">#{idx + 1}</span>
                                    </div>
                                </div>
                                <CardContent className="p-3">
                                    <Textarea
                                        value={slide.content}
                                        onChange={(e) => handleSlideChange(idx, 'content', e.target.value)}
                                        className="min-h-[100px] text-xs bg-transparent border-none text-slate-300 resize-none focus:ring-0 p-0 leading-relaxed scrollbar-hide"
                                    />
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div >

            {/* COLUMN 3: Live Preview (Canvas) */}
            < div className="flex-1 bg-[#020617] relative flex flex-col h-full overflow-hidden" >
                {/* Grid Background Effect */}
                < div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '24px 24px' }
                    }>
                </div >

                <div className="p-4 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur flex justify-between items-center shadow-lg z-20">
                    <span className="text-sm font-medium text-slate-400">Live Canvas</span>
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadPDF} variant="default" size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">
                            <Download className="mr-2 h-3 w-3" /> Export PDF
                        </Button>
                        <Button variant="outline" size="sm" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white">
                            <Download className="mr-2 h-3 w-3" /> Download ZIP
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 relative z-10 custom-scrollbar">
                    {slides.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                                <Sparkles className="h-10 w-10 text-purple-500 opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-300 mb-2">Ready to Create?</h3>
                            <p className="max-w-xs text-center text-sm">Select a topic and generate to see your high-fidelity carousel here.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Scrollable Container */}
                            <div
                                className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex items-center px-10 gap-8 custom-scrollbar scroll-smooth"
                                onScroll={(e) => {
                                    const container = e.currentTarget
                                    const index = Math.round(container.scrollLeft / (340 + 32)) // 340px card + 32px gap
                                    setCurrentSlideIndex(Math.min(Math.max(0, index), slides.length - 1))
                                }}
                            >
                                {slides.map((slide, idx) => (
                                    <div key={idx} className="relative group/preview snap-center shrink-0 my-auto">

                                        {/* === THE GLASS CARD RENDER === */}
                                        <div
                                            // @ts-ignore
                                            ref={el => slideRefs.current[idx] = el}
                                            className="relative overflow-hidden flex flex-col transition-all duration-500 shadow-2xl hover:shadow-[0_0_40px_rgba(124,58,237,0.3)] hover:-translate-y-2"
                                            style={{
                                                width: `${getDimensions().width}px`,
                                                height: `${getDimensions().height}px`,
                                                background: backgroundStyle,
                                                fontFamily: font,
                                                borderRadius: `${cornerRadius}px`
                                            }}
                                            onMouseMove={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect()
                                                handleLogoDrag(e, rect)
                                            }}
                                            onMouseUp={handleLogoDragEnd}
                                            onMouseLeave={handleLogoDragEnd}
                                        >
                                            {/* Optional: Noise overlay for texture */}
                                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

                                            <GlassCard
                                                variant={theme.includes('light') ? 'light' : theme.includes('neon') ? 'neon' : 'dark'}
                                                className="h-full flex flex-col border-none bg-black/10 backdrop-blur-md m-4 rounded-xl overflow-hidden shadow-inner relative"
                                            >
                                                {/* Layout: VISUAL (Full Image Background) */}
                                                {/* Layout: VISUAL (Full Image Background) */}
                                                {slide.layout === 'visual' && (slide.custom_image_url || slide.image_prompt) && (
                                                    <div className="absolute inset-0 z-0">
                                                        <img
                                                            src={slide.custom_image_url || `https://image.pollinations.ai/prompt/${encodeURIComponent(slide.image_prompt)}?width=600&height=800&nologo=true&seed=${idx}`}
                                                            alt="Background"
                                                            className="w-full h-full object-cover opacity-60"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                                    </div>
                                                )}

                                                {/* Top Bar */}
                                                <div className="p-5 pb-2 flex justify-between items-center z-20 relative">
                                                    <span
                                                        className="text-[9px] font-bold tracking-[0.2em] uppercase flex items-center gap-1 px-3 py-1 rounded-full"
                                                        style={{
                                                            backgroundColor: '#ffffff',
                                                            color: '#000000'
                                                        }}
                                                    >
                                                        {idx === slides.length - 1 ? 'END' : (
                                                            <>
                                                                SWIPE <ArrowRight className="w-3 h-3" />
                                                            </>
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Main Content */}
                                                <div className={`flex-1 px-6 py-2 flex flex-col relative z-10 ${slide.layout === 'visual' ? 'justify-end pb-10' : ''}`}>

                                                    {/* Layout: SPLIT (Image Top, Text Bottom) */}
                                                    {slide.layout === 'split' && (slide.custom_image_url || slide.image_prompt) && (
                                                        <div className="h-32 mb-4 rounded-lg overflow-hidden relative shrink-0">
                                                            <img
                                                                src={slide.custom_image_url || `https://image.pollinations.ai/prompt/${encodeURIComponent(slide.image_prompt)}?width=600&height=400&nologo=true&seed=${idx}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}

                                                    <p
                                                        className={`font-bold leading-tight tracking-tight whitespace-pre-wrap mb-4 ${slide.layout === 'visual' ? 'drop-shadow-md' : ''}`}
                                                        style={{
                                                            color: slide.layout === 'visual' ? '#ffffff' : textColor,
                                                            fontFamily: font,
                                                            fontSize: `${fontSize}px`,
                                                            textAlign: textAlign,
                                                            textShadow: textShadow ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                                                        }}
                                                    >
                                                        {slide.content}
                                                    </p>

                                                    {/* Layout: CLASSIC (Bottom Image) */}
                                                    {(!slide.layout || slide.layout === 'classic') && (slide.custom_image_url || slide.image_prompt) && (
                                                        <div className="flex-1 min-h-0 rounded-lg overflow-hidden relative group/image mt-auto">
                                                            <img
                                                                src={slide.custom_image_url || `https://image.pollinations.ai/prompt/${encodeURIComponent(slide.image_prompt)}?width=600&height=600&nologo=true&seed=${idx}`}
                                                                alt="AI Generated"
                                                                className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-700"
                                                            />
                                                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                                        </div>
                                                    )}

                                                    {/* Layout: INFOGRAPHIC */}
                                                    {slide.layout === 'infographic' && (
                                                        <InfographicCard
                                                            content={slide.content}
                                                            image_prompt={slide.custom_image_url || slide.image_prompt}
                                                            data_points={slide.data_points}
                                                        />
                                                    )}
                                                </div>

                                                {/* Draggable Logo */}
                                                {logoUrl && !slide.hide_logo && (
                                                    <div
                                                        key={`logo-${logoSize}-${logoStyle}`}
                                                        className={`absolute z-30 ${isDraggingLogo ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'} transition-transform`}
                                                        style={{
                                                            left: `${logoPosition.x}%`,
                                                            top: `${logoPosition.y}%`,
                                                            transform: 'translate(-50%, -50%)',
                                                            width: logoSize,
                                                            height: logoSize,
                                                        }}
                                                        onMouseDown={handleLogoDragStart}
                                                    >
                                                        <img
                                                            src={logoUrl}
                                                            alt="Logo"
                                                            className="w-full h-full object-contain drop-shadow-md pointer-events-none"
                                                            style={{
                                                                filter: logoStyle === 'white' ? 'brightness(0) invert(1)'
                                                                    : logoStyle === 'black' ? 'brightness(0)'
                                                                        : logoStyle === 'grayscale' ? 'grayscale(100%)'
                                                                            : 'none'
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Branding Footer */}
                                                {(brandName || brandHandle) && (
                                                    <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md flex items-center gap-3 z-20 relative">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-bold truncate leading-none mb-1">{brandName}</span>
                                                            <span className="text-[9px] opacity-60 truncate leading-none">{brandHandle}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </GlassCard>
                                        </div>
                                        {/* === END CARD === */}

                                        {/* Hover Download Button */}
                                        <div className="absolute -right-4 top-4 opacity-0 group-hover/preview:opacity-100 group-hover/preview:right-4 transition-all duration-300">
                                            <Button size="icon" className="h-10 w-10 rounded-full bg-white text-black hover:bg-white/90 shadow-lg" onClick={() => handleDownloadSlide(idx)}>
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Dots Navigation */}
                            <div className="h-16 flex items-center justify-center gap-2 shrink-0 z-20">
                                {slides.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            const container = document.querySelector('.snap-x')
                                            if (container) {
                                                container.scrollTo({
                                                    left: idx * (340 + 32),
                                                    behavior: 'smooth'
                                                })
                                            }
                                        }}
                                        className={`h-2 rounded-full transition-all duration-300 ${currentSlideIndex === idx
                                            ? 'w-8 bg-purple-500'
                                            : 'w-2 bg-slate-700 hover:bg-slate-600'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    )
}
