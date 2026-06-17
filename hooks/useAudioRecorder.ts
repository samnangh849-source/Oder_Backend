import { useState, useRef } from 'react';

type AudioRecorderHook = {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
};

// List of preferred MIME types, ordered by preference.
// 'audio/mp4' (AAC) is highly compatible, especially with Apple devices.
// 'audio/webm;codecs=opus' is the modern, efficient standard.
const PREFERRED_MIME_TYPES = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
];

export const useAudioRecorder = (): AudioRecorderHook => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string>('audio/webm'); // Default fallback

    const startRecording = async (): Promise<void> => {
        if (isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Find the best supported MIME type
            const supportedMimeType = PREFERRED_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));
            
            if (!supportedMimeType) {
                 alert('Your browser does not support any of the required audio recording formats.');
                 console.error('No supported audio MIME types found.');
                 return;
            }

            mimeTypeRef.current = supportedMimeType;
            console.log(`Using MIME type for recording: ${supportedMimeType}`);
            
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                // Clean up the stream tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting audio recording:", err);
            if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                alert('ការអនុញ្ញាតឱ្យប្រើមីក្រូហ្វូនត្រូវបានបដិសេធ។ សូមអនុញ្ញាតឱ្យចូលប្រើមីក្រូហ្វូននៅក្នុងការកំណត់កម្មវិធីរុករករបស់អ្នក ដើម្បីប្រើមុខងារនេះ។');
            } else {
                alert('មិនអាចចាប់ផ្តើមការថតសំឡេងបានទេ។ សូមប្រាកដថាអ្នកបានភ្ជាប់មីក្រូហ្វូន ហើយបានផ្តល់ការអនុញ្ញាត។');
            }
        }
    };

    const stopRecording = (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || !isRecording) {
                resolve(null);
                return;
            }

            mediaRecorderRef.current.onstop = () => {
                // The onstop event handler is called after all data has been collected.
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
                
                // Clean up the stream tracks from the original onstop to ensure they are stopped here
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
                
                resolve(audioBlob);
            };

            mediaRecorderRef.current.stop();
            setIsRecording(false);
        });
    };

    return { isRecording, startRecording, stopRecording };
};
