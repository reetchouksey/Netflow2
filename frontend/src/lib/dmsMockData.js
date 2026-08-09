export const DMS_MOCK_DATA = {
  stats: {
    totalDocs: 12458,
    docsTrend: '+18% from last month',
    totalFolders: 342,
    foldersTrend: '+9% from last month',
    storageUsedGB: 245.6,
    storageTotalGB: 500,
    storagePct: 49,
    uploadedMonth: 1245,
    downloadedMonth: 876,
    sharedMonth: 64,
  },
  folders: [
    {
      id: 'f1',
      name: 'HR Department',
      icon: 'folder',
      isOpen: true,
      children: [
        { id: 'f1-1', name: 'Leave Requests', isActive: true },
        { id: 'f1-2', name: 'Employee Onboarding' },
        { id: 'f1-3', name: 'Policy Documents' },
        { id: 'f1-4', name: 'Exit Process' }
      ]
    },
    {
      id: 'f2',
      name: 'Finance Department',
      icon: 'folder',
      children: [
        { id: 'f2-1', name: 'Invoices' },
        { id: 'f2-2', name: 'Expense Claims' },
        { id: 'f2-3', name: 'Purchase Orders' },
        { id: 'f2-4', name: 'Payments' }
      ]
    },
    {
      id: 'f3',
      name: 'IT Department',
      icon: 'folder',
      children: [
        { id: 'f3-1', name: 'Asset Requests' },
        { id: 'f3-2', name: 'Access Requests' },
        { id: 'f3-3', name: 'Software Licenses' }
      ]
    },
    {
      id: 'f4',
      name: 'Admin Department',
      icon: 'folder',
      children: [
        { id: 'f4-1', name: 'Notices' },
        { id: 'f4-2', name: 'General Documents' }
      ]
    },
    {
      id: 'f5',
      name: 'Shared',
      icon: 'folder-shared',
      children: [
        { id: 'f5-1', name: 'Company Policies' },
        { id: 'f5-2', name: 'Templates' }
      ]
    }
  ],
  documents: [
    {
      id: 'd1',
      name: 'Medical_Certificate_Aman.pdf',
      type: 'PDF',
      typeLabel: 'Medical',
      typeColor: 'blue',
      uploadedBy: 'Aman Singh',
      role: 'HR Executive',
      avatar: 'AS',
      size: '2.45 MB',
      date: '31 May 2026, 10:30 AM',
      tags: ['Medical'],
      desc: 'Medical certificate for leave request dated 31 May 2026.',
      path: '/Netlink/HR/Leave Requests/Medical_Certificate_Aman.pdf',
      docId: 'DMS-1029384756',
      version: '1.0',
      synced: '31 May 2026, 10:32 AM',
      status: 'Synced'
    },
    {
      id: 'd2',
      name: 'Leave_Application_Form.docx',
      type: 'DOCX',
      typeLabel: 'Application',
      typeColor: 'indigo',
      uploadedBy: 'Neha Patel',
      role: 'HR Executive',
      avatar: 'NP',
      size: '1.25 MB',
      date: '31 May 2026, 10:15 AM',
      tags: ['Leave'],
      desc: 'Standard leave application format.',
      path: '/Netlink/HR/Leave Requests/Leave_Application_Form.docx',
      docId: 'DMS-1029384757',
      version: '1.2',
      synced: '31 May 2026, 10:20 AM',
      status: 'Synced'
    },
    {
      id: 'd3',
      name: 'Leave_Tracker_May2026.xlsx',
      type: 'XLSX',
      typeLabel: 'Report',
      typeColor: 'emerald',
      uploadedBy: 'Rohit Kumar',
      role: 'HR Manager',
      avatar: 'RK',
      size: '85.6 KB',
      date: '31 May 2026, 09:45 AM',
      tags: ['Tracker', 'Report'],
      desc: 'Monthly leave tracking sheet for all departments.',
      path: '/Netlink/HR/Leave Requests/Leave_Tracker_May2026.xlsx',
      docId: 'DMS-1029384758',
      version: '3.1',
      synced: '31 May 2026, 09:50 AM',
      status: 'Synced'
    },
    {
      id: 'd4',
      name: 'Comp_Off_Request_Form.pdf',
      type: 'PDF',
      typeLabel: 'Comp Off',
      typeColor: 'blue',
      uploadedBy: 'Vikram Singh',
      role: 'HR Executive',
      avatar: 'VS',
      size: '1.75 MB',
      date: '30 May 2026, 04:20 PM',
      tags: ['Comp Off', 'Request'],
      desc: 'Compensatory off request form.',
      path: '/Netlink/HR/Leave Requests/Comp_Off_Request_Form.pdf',
      docId: 'DMS-1029384759',
      version: '1.0',
      synced: '30 May 2026, 04:25 PM',
      status: 'Synced'
    },
    {
      id: 'd5',
      name: 'ID_Card_Photo_Sneha.jpg',
      type: 'JPG',
      typeLabel: 'ID Proof',
      typeColor: 'emerald',
      uploadedBy: 'Sneha Reddy',
      role: 'HR Executive',
      avatar: 'SR',
      size: '450 KB',
      date: '30 May 2026, 03:10 PM',
      tags: ['Photo', 'ID'],
      desc: 'Passport size photo for new ID card.',
      path: '/Netlink/HR/Employee Onboarding/ID_Card_Photo_Sneha.jpg',
      docId: 'DMS-1029384760',
      version: '1.0',
      synced: '30 May 2026, 03:15 PM',
      status: 'Synced'
    },
    {
      id: 'd6',
      name: 'Policy_Leave_2026.pdf',
      type: 'PDF',
      typeLabel: 'Policy',
      typeColor: 'orange',
      uploadedBy: 'Aman Sharma',
      role: 'Org Admin',
      avatar: 'AS',
      size: '945 KB',
      date: '29 May 2026, 11:05 AM',
      tags: ['Policy', '2026'],
      desc: 'Updated leave policy for the year 2026.',
      path: '/Netlink/HR/Policy Documents/Policy_Leave_2026.pdf',
      docId: 'DMS-1029384761',
      version: '2.0',
      synced: '29 May 2026, 11:10 AM',
      status: 'Synced'
    },
    {
      id: 'd7',
      name: 'Maternity_Leave_Guidelines.docx',
      type: 'DOCX',
      typeLabel: 'Guidelines',
      typeColor: 'indigo',
      uploadedBy: 'Neha Patel',
      role: 'HR Executive',
      avatar: 'NP',
      size: '1.15 MB',
      date: '29 May 2026, 10:20 AM',
      tags: ['Guidelines', 'Leave'],
      desc: 'Guidelines for maternity leave applications.',
      path: '/Netlink/HR/Policy Documents/Maternity_Leave_Guidelines.docx',
      docId: 'DMS-1029384762',
      version: '1.1',
      synced: '29 May 2026, 10:25 AM',
      status: 'Synced'
    },
    {
      id: 'd8',
      name: 'WFH_Request_Form.pdf',
      type: 'PDF',
      typeLabel: 'WFH',
      typeColor: 'blue',
      uploadedBy: 'Pooja Mehta',
      role: 'HR Executive',
      avatar: 'PM',
      size: '1.32 MB',
      date: '28 May 2026, 05:30 PM',
      tags: ['WFH', 'Request'],
      desc: 'Work from home request form template.',
      path: '/Netlink/HR/Leave Requests/WFH_Request_Form.pdf',
      docId: 'DMS-1029384763',
      version: '1.0',
      synced: '28 May 2026, 05:35 PM',
      status: 'Synced'
    }
  ]
}
