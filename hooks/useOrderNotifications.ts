import { useEffect, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { WEB_APP_URL } from '../constants';
import { sendSystemNotification } from '../utils/notificationUtils';
import { ParsedOrder } from '../types';

export const useOrderNotifications = () => {
    const { currentUser, advancedSettings, showNotification } = useContext(AppContext);
    const previousOrdersRef = useRef<Record<string, string>>({});
    const notifiedPendingRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!currentUser) return;

        const checkUpdates = async () => {
            try {
                // Fetch recent orders with cache busting
                const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders?days=2&_t=${Date.now()}`);
                if (!response.ok) return;
                const result = await response.json();
                if (result.status !== 'success') return;

                const currentOrders: ParsedOrder[] = result.data || [];
                const newStatusMap: Record<string, string> = {};
                const now = new Date().getTime();

                let isFirstLoad = Object.keys(previousOrdersRef.current).length === 0;

                currentOrders.forEach(order => {
                    if (!order || !order['Order ID']) return;
                    const id = order['Order ID'];
                    
                    // Canonical status detection (handle both space and CamelCase)
                    const status = order['Fulfillment Status'] || order.FulfillmentStatus || 'Pending';
                    newStatusMap[id] = status;

                    const prevStatus = previousOrdersRef.current[id];

                    // 1. Detect New Orders
                    if (!isFirstLoad && !prevStatus && status === 'Pending') {
                        const title = '🆕 មានកុម្ម៉ង់ថ្មី!';
                        const body = `មានកុម្ម៉ង់ថ្មីពីអតិថិជន ${order['Customer Name']} (ID: #${id.substring(0,8)})`;
                        sendSystemNotification(title, body);
                        showNotification(body, 'info', title);
                    }

                    // 2. Detect Status Changes
                    if (!isFirstLoad && prevStatus && prevStatus !== status) {
                        console.log(`Notification: Order ${id} changed from ${prevStatus} to ${status}`);
                        let title = '';
                        let body = '';
                        let type: 'success' | 'info' | 'error' = 'info';
                        
                        if (status === 'Ready to Ship') {
                            title = '📦 កញ្ចប់ឥវ៉ាន់បានវេចខ្ចប់រួចរាល់';
                            body = `កញ្ចប់ឥវ៉ាន់ #${id.substring(0,8)} របស់អតិថិជន ${order['Customer Name']} ត្រូវបានវេចខ្ចប់ដោយ ${order['Packed By'] || 'បុគ្គលិក'}។`;
                            type = 'success';
                        } else if (status === 'Shipped') {
                            title = '🚚 កញ្ចប់ឥវ៉ាន់បានបញ្ចេញ';
                            body = `កញ្ចប់ឥវ៉ាន់ #${id.substring(0,8)} ត្រូវបានប្រគល់ឱ្យ ${order['Driver Name'] || order['Internal Shipping Details'] || 'អ្នកដឹក'} រួចរាល់។`;
                            type = 'success';
                        } else if (status === 'Delivered') {
                            title = '✅ ដឹកជញ្ជូនជោគជ័យ';
                            body = `កញ្ចប់ឥវ៉ាន់ #${id.substring(0,8)} បានដល់ដៃអតិថិជន ${order['Customer Name']} រួចរាល់។`;
                            type = 'success';
                        }

                        if (title) {
                            sendSystemNotification(title, body);
                            showNotification(body, type, title);
                        }
                    }

                    // 3. Check for Pending > 30 mins
                    if (status === 'Pending') {
                        let orderTime = 0;
                        if (order.Timestamp) {
                            const match = order.Timestamp.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
                            if (match) {
                                orderTime = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
                            } else {
                                orderTime = new Date(order.Timestamp).getTime();
                            }
                        }

                        if (orderTime > 0 && (now - orderTime) > 30 * 60 * 1000) {
                            if (!notifiedPendingRef.current.has(id)) {
                                const title = '⚠️ កញ្ចប់ឥវ៉ាន់យឺតយ៉ាវ (Over 30m)';
                                const body = `កញ្ចប់ឥវ៉ាន់ #${id.substring(0,8)} របស់អតិថិជន ${order['Customer Name']} មិនទាន់បានវេចខ្ចប់លើសពី 30 នាទីហើយ!`;
                                sendSystemNotification(title, body);
                                showNotification(body, 'error', title);
                                notifiedPendingRef.current.add(id);
                            }
                        }
                    } else {
                        // If it's no longer pending, remove from notified set so we don't leak memory
                        if (notifiedPendingRef.current.has(id)) {
                            notifiedPendingRef.current.delete(id);
                        }
                    }
                });

                previousOrdersRef.current = newStatusMap;
            } catch (e) {
                console.error("Failed to fetch order notifications", e);
            }
        };

        // Initial check immediately on mount
        checkUpdates();

        // Polling every 20 seconds for better responsiveness
        const intervalId = setInterval(checkUpdates, 20000);
        return () => clearInterval(intervalId);

    }, [currentUser]);
};