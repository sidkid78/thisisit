/**
 * Image conversion utilities for handling various image formats
 * Particularly useful for iOS HEIC/HEIF photos
 */

// Check if file is HEIC/HEIF format
export function isHeicFile(file: File): boolean {
    const heicTypes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
    const heicExtensions = ['.heic', '.heif']
    
    // Check MIME type
    if (heicTypes.includes(file.type.toLowerCase())) {
        return true
    }
    
    // Check file extension (iOS sometimes doesn't set correct MIME type)
    const fileName = file.name.toLowerCase()
    return heicExtensions.some(ext => fileName.endsWith(ext))
}

// Dynamically import heic2any only when needed (reduces bundle size)
async function getHeic2Any() {
    const heic2any = await import('heic2any')
    return heic2any.default
}

/**
 * Convert HEIC/HEIF image to JPEG
 * @param file - The HEIC/HEIF file to convert
 * @param quality - JPEG quality (0-1), default 0.85
 * @returns Promise<File> - The converted JPEG file
 */
export async function convertHeicToJpeg(file: File, quality: number = 0.85): Promise<File> {
    if (!isHeicFile(file)) {
        return file // Return original if not HEIC
    }

    try {
        const heic2any = await getHeic2Any()
        
        const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality
        })

        // heic2any can return a single blob or array of blobs
        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob

        // Create new File with .jpg extension
        const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
        return new File([resultBlob], newFileName, { type: 'image/jpeg' })
    } catch (error) {
        console.error('HEIC conversion failed:', error)
        throw new Error('Failed to convert HEIC image. Please try a different image format.')
    }
}

/**
 * Convert HEIC/HEIF image to PNG (for transparency support)
 * @param file - The HEIC/HEIF file to convert
 * @returns Promise<File> - The converted PNG file
 */
export async function convertHeicToPng(file: File): Promise<File> {
    if (!isHeicFile(file)) {
        return file
    }

    try {
        const heic2any = await getHeic2Any()
        
        const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/png'
        })

        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
        const newFileName = file.name.replace(/\.(heic|heif)$/i, '.png')
        return new File([resultBlob], newFileName, { type: 'image/png' })
    } catch (error) {
        console.error('HEIC to PNG conversion failed:', error)
        throw new Error('Failed to convert HEIC image.')
    }
}

/**
 * Process an array of files, converting any HEIC files to JPEG
 * @param files - Array of files to process
 * @param onProgress - Optional callback for progress updates
 * @returns Promise<File[]> - Array of processed files
 */
export async function processImageFiles(
    files: File[],
    onProgress?: (current: number, total: number) => void
): Promise<File[]> {
    const processedFiles: File[] = []
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        onProgress?.(i + 1, files.length)
        
        if (isHeicFile(file)) {
            const converted = await convertHeicToJpeg(file)
            processedFiles.push(converted)
        } else {
            processedFiles.push(file)
        }
    }
    
    return processedFiles
}

/**
 * Resize image to max dimensions while maintaining aspect ratio
 * @param file - Image file to resize
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @param quality - JPEG quality (0-1)
 * @returns Promise<File> - Resized image file
 */
export async function resizeImage(
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.85
): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        img.onload = () => {
            let { width, height } = img
            
            // Calculate new dimensions
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
            }
            
            canvas.width = width
            canvas.height = height
            
            ctx?.drawImage(img, 0, 0, width, height)
            
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const resizedFile = new File([blob], file.name, { type: 'image/jpeg' })
                        resolve(resizedFile)
                    } else {
                        reject(new Error('Failed to resize image'))
                    }
                },
                'image/jpeg',
                quality
            )
        }
        
        img.onerror = () => reject(new Error('Failed to load image for resizing'))
        img.src = URL.createObjectURL(file)
    })
}

/**
 * Get image dimensions
 * @param file - Image file
 * @returns Promise<{width: number, height: number}>
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            resolve({ width: img.width, height: img.height })
            URL.revokeObjectURL(img.src)
        }
        img.onerror = () => {
            URL.revokeObjectURL(img.src)
            reject(new Error('Failed to load image'))
        }
        img.src = URL.createObjectURL(file)
    })
}

/**
 * Validate image file (size, dimensions, format)
 * @param file - File to validate
 * @param options - Validation options
 * @returns Promise<{valid: boolean, error?: string}>
 */
export async function validateImageFile(
    file: File,
    options: {
        maxSizeMB?: number
        maxWidth?: number
        maxHeight?: number
        allowedTypes?: string[]
    } = {}
): Promise<{ valid: boolean; error?: string }> {
    const {
        maxSizeMB = 10,
        maxWidth = 8000,
        maxHeight = 8000,
        allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    } = options

    // Check file type
    const fileType = file.type.toLowerCase()
    const isHeic = isHeicFile(file)
    if (!isHeic && !allowedTypes.includes(fileType)) {
        return { valid: false, error: `Unsupported file type: ${fileType}` }
    }

    // Check file size
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxSizeMB) {
        return { valid: false, error: `File too large: ${sizeMB.toFixed(1)}MB (max ${maxSizeMB}MB)` }
    }

    // Check dimensions (skip for HEIC as we can't easily read dimensions before conversion)
    if (!isHeic) {
        try {
            const { width, height } = await getImageDimensions(file)
            if (width > maxWidth || height > maxHeight) {
                return { 
                    valid: false, 
                    error: `Image too large: ${width}x${height} (max ${maxWidth}x${maxHeight})` 
                }
            }
        } catch {
            // If we can't read dimensions, allow the file through
        }
    }

    return { valid: true }
}
