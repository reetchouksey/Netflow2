// frontend/src/prototype/PrototypeContext.jsx
// ISOLATED CLIENT-SIDE STATE FOR UX PROTOTYPE PREVIEW ONLY
// No backend API calls or production stores are touched.

import React, { createContext, useContext, useState, useMemo } from 'react';
import { MOCK_MANAGERS, INITIAL_MOCK_REQUESTS, MOCK_EMPLOYEES_ROSTER } from './mockData';

const PrototypeContext = createContext(null);

export function PrototypeProvider({ children }) {
  // Mock requests state
  const [requests, setRequests] = useState(() => INITIAL_MOCK_REQUESTS);

  // Active mock manager for simulation
  const [currentManager, setCurrentManager] = useState(() => MOCK_MANAGERS[0]); // Default Neha Kapoor (Sales)

  // Selected request for detail modal / inline review
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  // Active prototype view tab: 'manager' | 'employee' | 'team' | 'split'
  const [activeTab, setActiveTab] = useState('manager');

  // Filtered employees for "My Team" scoped strictly to currentManager.department
  const teamEmployees = useMemo(() => {
    if (!currentManager?.department) return [];
    return MOCK_EMPLOYEES_ROSTER.filter(
      (emp) => emp.department.toLowerCase() === currentManager.department.toLowerCase()
    );
  }, [currentManager]);

  // Actions for Feature 1 (Approval & Rejection)
  const approveRequest = (requestId, comment = '') => {
    const now = new Date();
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            status: 'Approved',
            decidedBy: currentManager.name,
            decidedAt: now.toISOString(),
            managerComment: comment.trim() || 'Approved without additional comment.',
          };
        }
        return req;
      })
    );
  };

  const rejectRequest = (requestId, reason) => {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A rejection reason is required before rejecting a request.' };
    }

    const now = new Date();
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            status: 'Rejected',
            decidedBy: currentManager.name,
            decidedAt: now.toISOString(),
            managerComment: reason.trim(),
          };
        }
        return req;
      })
    );

    return { success: true };
  };

  const resetData = () => {
    setRequests(INITIAL_MOCK_REQUESTS);
    setCurrentManager(MOCK_MANAGERS[0]);
    setSelectedRequestId(null);
  };

  const value = {
    requests,
    currentManager,
    setCurrentManager,
    availableManagers: MOCK_MANAGERS,
    teamEmployees,
    selectedRequestId,
    setSelectedRequestId,
    activeTab,
    setActiveTab,
    approveRequest,
    rejectRequest,
    resetData,
  };

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const context = useContext(PrototypeContext);
  if (!context) {
    throw new Error('usePrototype must be used within a PrototypeProvider');
  }
  return context;
}
