
import React, { useContext, useState, useEffect } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { LABEL_PRINTER_URL_BASE, WEB_APP_URL } from '../../constants';
import { useOrderTotals } from './OrderGrandTotal';
import OrdersListDesktop from './OrdersListDesktop';
import OrdersListMobile from './OrdersListMobile';
import OrdersListTablet from './OrdersListTablet'; // Import Tablet Component
import { printViaIframe } from '../../utils/printUtils';

interface OrdersListProps {
    orders: ParsedOrder[];
    onEdit?: (order: ParsedOrder) => void;
    onView?: (order: ParsedOrder) => void;
    showActions: boolean;
    visibleColumns?: Set<string>;
    // Selection Props
    selectedIds?: Set<string>;
    isSelectionMode?: boolean;
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: (ids: string[]) => void;
    showBorders?: boolean;
    groupBy?: string;
    viewMode?: 'card' | 'list';
    onOptimisticUpdate?: (callback: (ids: string[], status: string) => void) => void;
}

const OrdersList: React.FC<OrdersListProps> = ({ 
    orders, onEdit, onView, showActions, visibleColumns,
    selectedIds = new Set(), isSelectionMode = false, onToggleSelect, onToggleSelectAll,
    showBorders = false, groupBy = 'none', viewMode = 'card',
    onOptimisticUpdate
}) => {
    const { refreshData } = useContext(AppContext);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [localOrders, setLocalOrders] = useState<ParsedOrder[]>(orders);

    useEffect(() => {
        setLocalOrders(orders);
    }, [orders]);

    useEffect(() => {
        if (onOptimisticUpdate) {
            onOptimisticUpdate((ids, status) => {
                setLocalOrders(prev => prev.map(o => 
                    ids.includes(o['Order ID']) 
                    ? { ...o, 'Telegram Message ID 1': status } 
                    : o
                ));
            });
        }
    }, [onOptimisticUpdate]);

    // Use shared hook for totals
    const totals = useOrderTotals(orders);

    const toggleOrderVerified = async (orderId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        // Optimistic Update
        setLocalOrders(prev => prev.map(o => o['Order ID'] === orderId ? { ...o, IsVerified: newStatus } : o));
        setUpdatingIds(prev => new Set(prev).add(orderId));
        
        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ sheetName: 'AllOrders', primaryKey: { 'Order ID': orderId }, newData: { 'IsVerified': newStatus } })
            });
            if (!response.ok) throw new Error("Failed to save");
            refreshData();
        } catch (e) {
            console.error("Verification toggle failed:", e);
            // Revert on error
            setLocalOrders(prev => prev.map(o => o['Order ID'] === orderId ? { ...o, IsVerified: currentStatus } : o));
            alert("រក្សាទុកស្ថានភាពមិនបានសម្រេច!");
        } finally {
            setUpdatingIds(prev => { const next = new Set(prev); next.delete(orderId); return next; });
        }
    };

    const handleSendTelegram = async (orderId: string) => {
        // Optimistic update to show "Checking..." or similar
        setLocalOrders(prev => prev.map(o => o['Order ID'] === orderId ? { ...o, 'Telegram Message ID 1': 'CHECKING' } : o));
        setUpdatingIds(prev => new Set(prev).add(orderId));
        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ orderId, newData: { "Force Sync": true } })
            });
            if (!response.ok) throw new Error("Failed to send");
            // The background worker will update the IDs in the DB soon.
            // For immediate feedback, we wait for the broadcast or refresh.
            setTimeout(() => refreshData(), 2000); 
        } catch (e) {
            console.error("Telegram send failed:", e);
            // Revert optimistic update
            setLocalOrders(prev => prev.map(o => o['Order ID'] === orderId ? { ...o, 'Telegram Message ID 1': '' } : o));
            alert("ផ្ញើរទៅ Telegram មិនបានសម្រេច!");
        } finally {
            setUpdatingIds(prev => { const next = new Set(prev); next.delete(orderId); return next; });
        }
    };

    const formatPhone = (val: string) => {
        let phone = (val || '').replace(/[^0-9]/g, '');
        if (phone.length > 0) phone = '0' + phone.replace(/^0+/, '');
        return phone;
    };

    const handleCopy = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const generateTelegramTemplate = (order: ParsedOrder) => {
        const productLines = order.Products.map(p => {
            // Check if price is integer to format as 6$ or 6.50$
            const unitPrice = parseFloat(String(p.finalPrice || 0));
            const unitPriceStr = Number.isInteger(unitPrice) ? unitPrice : unitPrice.toFixed(2);
            
            const colorPart = p.colorInfo ? `-${p.colorInfo}` : '';
            return `🛍️ ${p.name}(${unitPriceStr}$)${colorPart} - x${p.quantity} ($${(p.total || 0).toFixed(2)})`;
        }).join('\n');

        const paymentText = order['Payment Status'] === 'Paid'
            ? '🟩 Paid'
            : '🟥 COD (Unpaid)';

        // Date format DD/MM/YYYY
        let dateStr = '';
        try {
             const d = new Date(order.Timestamp);
             if (!isNaN(d.getTime())) {
                 dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
             } else {
                 dateStr = String(order.Timestamp || '').split(' ')[0];
             }
        } catch(e) {
             dateStr = String(order.Timestamp || '');
        }

        const address = order['Address Details'] || '(មិនបានបញ្ជាក់)';

        // Updated Template Format as requested
        return `✅សូមបងពិនិត្យលេខទូរស័ព្ទ និងទីតាំងម្ដងទៀតបង 🙏
📃 Page: ${order.Page}
👤 អតិថិជន: ${order['Customer Name']}
📞 លេខទូរស័ព្ទ: ${order['Customer Phone']}
📍 ទីតាំង: ${order.Location}
🏠 អាសយដ្ឋាន: ${address}

 ----------- ផលិតផល -----------
${productLines}
--------------------------------------

💰 សរុប:
  - តម្លៃទំនិញ: $${(order.Subtotal || 0).toFixed(2)}
  - សេវាដឹក: $${(order['Shipping Fee (Customer)'] || 0).toFixed(2)}
  - សរុបចុងក្រោយ: $${(order['Grand Total'] || 0).toFixed(2)}
 ${paymentText}

🚚 វិធីសាស្រ្តដឹកជញ្ជូន: ${order['Internal Shipping Method']}
${dateStr}
--------------------------------------
អរគុណបង🙏🥰 | ID: ${order['Order ID']}`;
    };

    const handleCopyTemplate = (order: ParsedOrder) => {
        const text = generateTelegramTemplate(order);
        navigator.clipboard.writeText(text);
        setCopiedTemplateId(order['Order ID']);
        setTimeout(() => setCopiedTemplateId(null), 2000);
    };

    const handlePrint = (order: ParsedOrder) => {
        if (!order) return;
        const validatedPhone = formatPhone(order['Customer Phone']);
        const queryParams = new URLSearchParams({
            id: order['Order ID'],
            name: order['Customer Name'] || '',
            phone: validatedPhone,
            location: order.Location || '',
            address: order['Address Details'] || '',
            total: (order['Grand Total'] || 0).toString(),
            payment: order['Payment Status'] || 'Unpaid',
            shipping: order['Internal Shipping Method'] || 'N/A',
            page: order.Page || '',
            user: order.User || '',
            note: order.Note || '',
            store: order['Fulfillment Store'] || '',
        });
        const note = order.Note || '';
        const mapMatch = note.match(/https?:\/\/(www\.)?(google\.com\/maps|maps\.app\.goo\.gl)\/[^\s]+/);
        if (mapMatch) queryParams.set('map', mapMatch[0]);
        queryParams.set('view', 'print_label');
        printViaIframe(`${window.location.origin}${window.location.pathname}?${queryParams.toString()}`);
    };

    const [viewType, setViewType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 768) setViewType('mobile');
            else if (width < 1280) setViewType('tablet');
            else setViewType('desktop');
        };
        
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sharedProps = {
        orders: localOrders,
        totals,
        visibleColumns,
        selectedIds,
        isSelectionMode,
        onToggleSelect,
        onEdit,
        onView,
        handlePrint,
        handleCopy,
        handleCopyTemplate,
        copiedId,
        copiedTemplateId,
        toggleOrderVerified,
        handleSendTelegram,
        updatingIds,
        showBorders,
        groupBy,
        viewMode
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-0 space-y-4">
                {viewType === 'desktop' && (
                    <OrdersListDesktop 
                        {...sharedProps}
                        onToggleSelectAll={onToggleSelectAll}
                    />
                )}

                {viewType === 'tablet' && (
                    <OrdersListTablet 
                        {...sharedProps}
                    />
                )}

                {viewType === 'mobile' && (
                    <OrdersListMobile 
                        {...sharedProps}
                    />
                )}
            </div>
        </div>
    );
};

export default OrdersList;
