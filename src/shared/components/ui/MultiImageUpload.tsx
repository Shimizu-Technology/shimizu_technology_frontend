import React, { useState, useRef } from 'react';
import { X, MoveHorizontal, Upload } from 'lucide-react';

interface ImageFile {
  id: string;
  file: File;
  url: string;
}

interface MultiImageUploadProps {
  maxImages?: number;
  maxSizeInMB?: number;
  allowedTypes?: string[];
  existingImages?: { id: number | string; url: string }[];
  onChange: (files: File[]) => void;
  onReorder?: (newOrder: (number | string)[]) => void;
  onDelete?: (imageId: number | string) => void;
  className?: string;
  frontBackLabels?: boolean; // Add option to show front/back labels
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  maxImages = 2, // Default to 2 images for front/back
  maxSizeInMB = 5,
  allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  existingImages = [],
  onChange,
  onReorder,
  onDelete,
  className = '',
  frontBackLabels = false,
}) => {
  const [uploadedImages, setUploadedImages] = useState<ImageFile[]>([]);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine existing and newly uploaded images for display
  const combinedImages = [
    ...existingImages.map(img => ({
      id: img.id.toString(),
      isExisting: true,
      url: img.url,
    })),
    ...uploadedImages.map(img => ({
      id: img.id,
      isExisting: false,
      url: img.url,
      file: img.file,
    })),
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const newErrors: string[] = [];
    const validFiles: File[] = [];
    
    // Validate total count
    if (combinedImages.length + newFiles.length > maxImages) {
      newErrors.push(`You can upload a maximum of ${maxImages} images`);
      return setErrors(newErrors);
    }
    
    // Validate each file
    newFiles.forEach(file => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        newErrors.push(`${file.name}: Invalid file type. Allowed types are ${allowedTypes.map(t => t.replace('image/', '')).join(', ')}`);
        return;
      }
      
      // Check file size
      if (file.size > maxSizeInMB * 1024 * 1024) {
        newErrors.push(`${file.name}: File size exceeds the limit of ${maxSizeInMB} MB`);
        return;
      }
      
      validFiles.push(file);
    });
    
    if (newErrors.length) {
      setErrors(newErrors);
      return;
    }
    
    const newUploadedImages = [
      ...uploadedImages,
      ...validFiles.map(file => ({
        id: `new-${Math.random().toString(36).substring(2, 9)}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ];
    
    setUploadedImages(newUploadedImages);
    onChange(newUploadedImages.map(img => img.file));
    
    // Reset the file input value so the same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedImageId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedImageId !== id) {
      setDragOverImageId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    
    if (!draggedImageId || draggedImageId === dropId) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }
    
    // Create a new order of images
    const draggedIndex = combinedImages.findIndex(img => img.id === draggedImageId);
    const dropIndex = combinedImages.findIndex(img => img.id === dropId);
    
    if (draggedIndex === -1 || dropIndex === -1) return;
    
    const newOrder = [...combinedImages];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    
    // Update states
    setDraggedImageId(null);
    setDragOverImageId(null);
    
    // Update uploaded images order
    const newUploadedImagesOrder = newOrder
      .filter(img => !('isExisting' in img) || !img.isExisting)
      .map(img => uploadedImages.find(uImg => uImg.id === img.id))
      .filter(Boolean) as ImageFile[];
    
    setUploadedImages(newUploadedImagesOrder);
    
    // Callback for reordering
    if (onReorder) {
      onReorder(newOrder.map(img => img.id));
    }
  };

  const handleDelete = (id: string) => {
    // Check if it's an existing image
    const isExistingImage = existingImages.some(img => img.id.toString() === id);
    
    if (isExistingImage && onDelete) {
      onDelete(id);
    } else {
      // Remove from uploaded images
      const newUploadedImages = uploadedImages.filter(img => img.id !== id);
      setUploadedImages(newUploadedImages);
      onChange(newUploadedImages.map(img => img.file));
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`multi-image-upload ${className}`}>
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-3">
          <p className="font-medium text-sm">Please correct the following errors:</p>
          <ul className="list-disc list-inside text-xs mt-1">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Main container for images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {combinedImages.map((image, index) => (
          <div
            key={image.id}
            draggable
            onDragStart={() => handleDragStart(image.id)}
            onDragOver={(e) => handleDragOver(e, image.id)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, image.id)}
            className={`
              relative rounded-md overflow-hidden border-2 aspect-square
              ${draggedImageId === image.id ? 'opacity-50 border-dashed border-gray-400' : ''}
              ${dragOverImageId === image.id ? 'border-[#c1902f]' : 'border-gray-200'}
              transition-all cursor-move
            `}
          >
            <img 
              src={image.url} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleDelete(image.id)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-40 p-1">
              <div className="flex items-center justify-center">
                <MoveHorizontal className="h-3 w-3 text-white" />
                <span className="text-white text-xs ml-1">
                  {frontBackLabels && combinedImages.length <= 2
                    ? index === 0 ? 'Front image' : 'Back image'
                    : 'Drag to reorder'}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {/* Upload placeholder - only show if under max images */}
        {combinedImages.length < maxImages && (
          <div
            onClick={handleClickUpload}
            className="border-2 border-dashed border-gray-300 rounded-md aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-6 w-6 text-gray-400 mb-1" />
            <span className="text-sm text-gray-500">Upload Image</span>
            <span className="text-xs text-gray-400 mt-1">{combinedImages.length} / {maxImages}</span>
          </div>
        )}
      </div>
      
      {/* Helper text */}
      <div className="text-xs text-gray-500">
        <p>Maximum {maxImages} images, {maxSizeInMB}MB each.</p>
        <p>Supported formats: {allowedTypes.map(t => t.replace('image/', '')).join(', ')}</p>
      </div>
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={allowedTypes.join(',')}
        onChange={handleFileChange}
        multiple={combinedImages.length < maxImages}
      />
    </div>
  );
};

export default MultiImageUpload;
