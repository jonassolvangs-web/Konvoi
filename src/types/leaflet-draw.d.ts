declare module 'leaflet-draw' {
  import * as L from 'leaflet';
  export = L;
}

declare module 'react-leaflet-draw' {
  import { ComponentType } from 'react';

  interface EditControlProps {
    position?: string;
    draw?: Record<string, any>;
    edit?: Record<string, any>;
    onCreated?: (e: any) => void;
    onEdited?: (e: any) => void;
    onDeleted?: (e: any) => void;
  }

  export const EditControl: ComponentType<EditControlProps>;
}
