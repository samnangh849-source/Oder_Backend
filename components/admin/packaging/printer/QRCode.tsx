import React from 'react';
import ReactQRCode from 'react-qr-code';

interface QRCodeProps {
  value: string;
  size?: number;
}

const QRCode: React.FC<QRCodeProps> = ({ value, size = 100 }) => {
  return (
    <div style={{ height: "auto", margin: "0 auto", maxWidth: size, width: "100%" }}>
      <ReactQRCode
        size={size}
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        value={value}
        viewBox={`0 0 256 256`}
      />
    </div>
  );
};

export default QRCode;