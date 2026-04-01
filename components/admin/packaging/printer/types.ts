export interface LabelData {
  id: string;
  name: string;
  phone: string;
  location: string;
  address: string;
  store: string;
  page: string;
  user: string;
  total: string;
  shipping: string;
  payment: string;
  note: string;
  mapLink: string;
  date: string;
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  lineLeft: number;
  lineRight: number;
}

export enum ThemeType {
  ACC = 'ACC Store',
  FLEXI = 'Flexi Gear'
}

export interface StyleConfig {
  fontSize: number;
}