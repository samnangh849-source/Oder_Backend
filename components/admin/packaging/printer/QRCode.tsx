import React from 'react';
import ReactQRCode from 'react-qr-code';
import { Box } from 'lucide-react';

interface QRCodeProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  showLogo?: boolean;
}

const QRCode: React.FC<QRCodeProps> = ({ 
    value, 
    size = 100, 
    fgColor = "#000000", 
    bgColor = "#FFFFFF",
    level = "H",
    showLogo = true
}) => {
  return (
    <div style={{ 
        position: "relative",
        height: "auto", 
        margin: "0 auto", 
        maxWidth: size, 
        width: "100%",
        padding: "6px", // Increased quiet zone
        backgroundColor: bgColor,
        borderRadius: "12px", // Smoother corners for the container
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
    }}>
      <ReactQRCode
        size={256}
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        value={value}
        viewBox={`0 0 256 256`}
        fgColor={fgColor}
        bgColor={bgColor}
        level={level}
      />
      
      {showLogo && (
          <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: bgColor,
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px rgba(0,0,0,0.05)"
          }}>
              <div style={{
                  backgroundColor: fgColor,
                  width: "14px",
                  height: "14px",
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: bgColor
              }}>
                  <Box size={8} strokeWidth={4} />
              </div>
          </div>
      )}
    </div>
  );
};

export default QRCode;