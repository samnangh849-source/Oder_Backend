
import React from 'react';
import { LabelData, ThemeType } from '../types';
import FlexiLabel from './FlexiLabel';
import AccLabel from './AccLabel';

interface LabelContentProps {
  data: LabelData;
  theme: ThemeType;
  lineLeft: number;
  lineRight: number;
  qrValue: string;
  isDesignMode: boolean;
  printDensity: number;
  watermarkIntensity: number;
}

const LabelContent: React.FC<LabelContentProps> = ({ data, theme, qrValue, isDesignMode, printDensity, watermarkIntensity }) => {
  if (theme === ThemeType.FLEXI) {
    return <FlexiLabel data={data} qrValue={qrValue} isDesignMode={isDesignMode} printDensity={printDensity} watermarkIntensity={watermarkIntensity} />;
  }
  return <AccLabel data={data} qrValue={qrValue} isDesignMode={isDesignMode} printDensity={printDensity} watermarkIntensity={watermarkIntensity} />;
};

export default LabelContent;
