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
      console.log('Fetching bookings...');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');

      const data = await response.json();
      console.log('Bookings data from API:', data);

      if (!Array.isArray(data) || data.length === 0) {
        console.log('No bookings found or invalid data format');
        setBookings([]);
        setIsLoading(false);
        return;
      }

      // Fetch service types first
      console.log('Fetching service types...');
      const serviceTypesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/service-types`, {
        headers: {
          Authorization: `Bearer ${getCookie('token')}`,
        },
      });
      const serviceTypes = await serviceTypesResponse.json();
      console.log('Service types data:', serviceTypes);

      // Check the structure of a booking row to understand the indexes
      if (data.length > 0) {
        console.log('First booking row structure:', data[0]);
        // Log all indexes to help identify the service_type_id position
        for (let i = 0; i < data[0].length; i++) {
          console.log(`Index ${i}:`, data[0][i]);
        }
      }

      // Add this function to map service types based on text values or IDs
      const getServiceTypeName = (value: any): string => {
        if (!value) return 'Unknown';

        // If the value is already a string like "photography", "videography", or "both"
        if (typeof value === 'string') {
          if (['photography', 'videography', 'both'].includes(value.toLowerCase())) {
            return value.toLowerCase();
          }
        }

        // If the value is a number (ID), map it
        if (typeof value === 'number') {
          if (value === 1) return 'photography';
          if (value === 2) return 'videography';
          if (value === 3) return 'both';
        }

        return 'Unknown';
      };

      // Transform the raw database rows into properly formatted Booking objects
      const formattedBookings: Booking[] = data.map((booking: any) => {
        // Log the entire booking row to verify its structure
        console.log('Booking row:', booking);

        // Try different approaches to find the service type
        let serviceTypeName = 'Unknown';

        // Look for the service type in the array
        for (let i = 0; i < booking.length; i++) {
          if (
            typeof booking[i] === 'string' &&
            ['photography', 'videography', 'both'].includes(booking[i].toLowerCase())
          ) {
            serviceTypeName = booking[i].toLowerCase();
            console.log(`Found service type at index ${i}: ${serviceTypeName}`);
            break;
          }
        }

        // If service type wasn't found directly, try using service_type_id
        if (serviceTypeName === 'Unknown') {
          // The service_type_id is expected at index 9, but might be elsewhere
          let serviceTypeId = null;

          // Try to find a numeric ID that might be the service type
          for (let i = 0; i < booking.length; i++) {
            if (typeof booking[i] === 'number' && booking[i] >= 1 && booking[i] <= 3) {
              serviceTypeId = booking[i];
              console.log(`Found potential service_type_id at index ${i}: ${serviceTypeId}`);
              break;
            }
          }

          // If we found a service type ID, map it to a name
          if (serviceTypeId) {
            serviceTypeName = getServiceTypeName(serviceTypeId);
            console.log(`Mapped service ID ${serviceTypeId} to: ${serviceTypeName}`);
          }
        }

        // Make sure the date is in a usable format, or default to current date
        let preferredDate = booking[4];
        if (!preferredDate) {
          console.log(`Booking ${booking[0]} has no preferred_date, using current date`);
          preferredDate = new Date().toISOString();
        }

        return {
          id: booking[0],
          client_name: booking[1] || 'Unknown',
          client_email: booking[2] || '',
          client_phone: booking[3] || '',
          preferred_date: preferredDate,
          additional_notes: booking[5],
          status: booking[6] || 'pending',
          google_calendar_event_id: booking[7],
          created_at: booking[8] || new Date().toISOString(),
          service_type: serviceTypeName,
        };
      });

      console.log('Formatted bookings:', formattedBookings);
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

      console.log(`Updating booking ${selectedBooking.id} status to ${statusValue}`);

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

      const data = await response.json();
      console.log('Status update response:', data);

      // Update local state
      setBookings((prevBookings) =>
        prevBookings.map((booking) =>
          booking.id === selectedBooking.id ? { ...booking, status: statusValue } : booking,
        ),
      );

      console.log(`Successfully updated booking ${selectedBooking.id} status to ${statusValue}`);

      // Close dialogs
      setShowConfirmDialog(false);
      setShowDetails(false);
    } catch (error) {
      console.error(`Error ${actionType}ing booking:`, error);
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
