import React, { useRef, useState } from 'react';
import { Button } from './ui';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  loadingMessage?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  disabled = false,
  loadingMessage,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

    if (!validTypes.includes(file.type)) {
      alert('Por favor, selecciona un archivo PDF o imagen (JPG, PNG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 10MB');
      return;
    }

    // Automatically process the file after validation
    onFileSelect(file);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
          ${dragActive ? 'border-primary bg-blue-50 scale-105' : 'border-gray-300 bg-gray-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-blue-50'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!disabled && !loadingMessage ? handleButtonClick : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <div className="text-6xl mb-4">📄</div>
        {loadingMessage ? (
          <>
            <div className="spinner-small"></div>
            <p className="text-base text-gray-600 font-medium">{loadingMessage}</p>
          </>
        ) : (
          <>
            <p className="text-lg text-gray-700 font-medium mb-6">
              Arrastra tu factura aquí o haz clic para seleccionar
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                handleButtonClick();
              }}
              disabled={disabled}
            >
              Seleccionar archivo
            </Button>
            <p className="text-sm text-gray-500 mt-6">
              Solo archivos PDF o imágenes (JPG, PNG), máximo 10MB
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
