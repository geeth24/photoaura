'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { getCookie } from 'cookies-next';

type Booking = {
  id: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  preferred_date: string;
  additional_notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  service_type: string;
  created_at: string;
};

export default function BookingsPage() {
  const { sidebarOpened } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBookings = async () => {
    try {
      const [bookingsRes, serviceTypesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
          headers: { Authorization: `Bearer ${getCookie('token')}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/service-types`, {
          headers: { Authorization: `Bearer ${getCookie('token')}` },
        }),
      ]);

      if (!bookingsRes.ok) throw new Error('Failed to fetch bookings');

      const data = await bookingsRes.json();
      const serviceTypes = await serviceTypesRes.json();

      if (!Array.isArray(data) || data.length === 0) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

      const serviceTypeMap = new Map(
        serviceTypes.map((st: { id: number; name: string }) => [st.id, st.name]),
      );

      const formattedBookings: Booking[] = data.map((booking: any[]) => ({
        id: booking[0],
        client_name: booking[1] || 'Unknown',
        client_email: booking[2] || '',
        client_phone: booking[3] || '',
        preferred_date: booking[4] || new Date().toISOString(),
        additional_notes: booking[5],
        status: booking[6] || 'pending',
        created_at: booking[8] || new Date().toISOString(),
        service_type: serviceTypeMap.get(booking[9]) || 'Unknown',
      }));

      setBookings(formattedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetails(true);
  };

  const handleStatusChange = async () => {
    if (!selectedBooking || !actionType) return;

    setIsProcessing(true);
    try {
      // Map action type to status for API call
      const statusValue = actionType === 'approve' ? 'approved' : 'rejected';

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/bookings/${selectedBooking.id}/status?status=${statusValue}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getCookie('token')}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from server:', errorText);
        throw new Error(
          `Failed to ${actionType} booking: ${response.status} ${response.statusText}`,
        );
      }

      await response.json();

      // Update local state
      setBookings((prevBookings) =>
        prevBookings.map((booking) =>
          booking.id === selectedBooking.id ? { ...booking, status: statusValue } : booking,
        ),
      );

      // Close dialogs
      setShowConfirmDialog(false);
      setShowDetails(false);
    } catch (error) {
      console.error('Error updating booking:', error);
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  const confirmAction = (action: 'approve' | 'reject') => {
    setActionType(action);
    setShowConfirmDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };

  // Add this helper function to safely format dates
  const formatDate = (
    dateString: string | null | undefined,
    formatString: string = 'MMM dd, yyyy',
  ): string => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), formatString);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <div className={`relative flex flex-col ${sidebarOpened ? 'pl-4' : ''} pr-4`}>
      <div className="mt-4 flex w-full items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
      </div>

      {isLoading ? (
        <div className="flex h-64 w-full items-center justify-center">
          <LoadingSpinner size={48} />
        </div>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>{booking.id}</TableCell>
                      <TableCell>{booking.client_name}</TableCell>
                      <TableCell>{booking.service_type}</TableCell>
                      <TableCell>{formatDate(booking.preferred_date)}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(booking)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Booking Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-medium">Client:</div>
                <div>{selectedBooking.client_name}</div>

                <div className="font-medium">Email:</div>
                <div>{selectedBooking.client_email}</div>

                <div className="font-medium">Phone:</div>
                <div>{selectedBooking.client_phone}</div>

                <div className="font-medium">Service:</div>
                <div>{selectedBooking.service_type}</div>

                <div className="font-medium">Date:</div>
                <div>{formatDate(selectedBooking.preferred_date, 'PPP p')}</div>

                <div className="font-medium">Status:</div>
                <div>{getStatusBadge(selectedBooking.status)}</div>
              </div>

              {selectedBooking.additional_notes && (
                <>
                  <div className="font-medium">Additional Notes:</div>
                  <div className="rounded bg-muted p-2 text-sm">
                    {selectedBooking.additional_notes}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2 sm:justify-between">
            {selectedBooking?.status === 'pending' && (
              <>
                <Button variant="destructive" onClick={() => confirmAction('reject')}>
                  Reject
                </Button>
                <Button onClick={() => confirmAction('approve')}>Approve</Button>
              </>
            )}
            {selectedBooking?.status !== 'pending' && (
              <Button onClick={() => setShowDetails(false)} className="ml-auto">
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' ? 'Approve Booking' : 'Reject Booking'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve'
                ? 'Are you sure you want to approve this booking? This will create an event in the calendar and notify the client.'
                : 'Are you sure you want to reject this booking? The client will be notified.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange} disabled={isProcessing}>
              {isProcessing ? (
                <LoadingSpinner size={16} />
              ) : actionType === 'approve' ? (
                'Approve'
              ) : (
                'Reject'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
