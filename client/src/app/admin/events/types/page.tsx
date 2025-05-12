'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getCookie } from 'cookies-next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EventType {
  id: number;
  name: string;
  priority: number;
  created_at: string;
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEventType, setNewEventType] = useState({ name: '', priority: 0 });
  const [open, setOpen] = useState(false);

  const fetchEventTypes = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event-types`);
      if (!response.ok) {
        throw new Error('Failed to fetch event types');
      }
      const data = await response.json();
      setEventTypes(data);
    } catch (error) {
      console.error('Error fetching event types:', error);
      toast.error('Failed to load event types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventTypes();
  }, []);

  const handleCreateEventType = async () => {
    if (!newEventType.name.trim()) {
      toast.error('Event type name is required');
      return;
    }

    try {
      const token = getCookie('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEventType),
      });

      if (!response.ok) {
        throw new Error('Failed to create event type');
      }

      toast.success('Event type created successfully');
      setNewEventType({ name: '', priority: 0 });
      setOpen(false);
      fetchEventTypes();
    } catch (error) {
      console.error('Error creating event type:', error);
      toast.error('Failed to create event type');
    }
  };

  const handleDeleteEventType = async (id: number) => {
    try {
      const token = getCookie('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event-types/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete event type');
      }

      toast.success('Event type deleted successfully');
      fetchEventTypes();
    } catch (error: any) {
      console.error('Error deleting event type:', error);
      toast.error(error.message || 'Failed to delete event type');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Event Types</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Event Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Event Type</DialogTitle>
              <DialogDescription>Add a new event type to categorize your events.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name">Name</label>
                <Input
                  id="name"
                  placeholder="Event Type Name"
                  value={newEventType.name}
                  onChange={(e) => setNewEventType({ ...newEventType, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="priority">Priority</label>
                <Input
                  id="priority"
                  type="number"
                  placeholder="Priority (higher numbers appear first)"
                  value={newEventType.priority}
                  onChange={(e) =>
                    setNewEventType({ ...newEventType, priority: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateEventType}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <p>Loading event types...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eventTypes.length === 0 ? (
            <div className="col-span-full flex h-40 items-center justify-center">
              <p className="text-gray-500">No event types found. Create one to get started.</p>
            </div>
          ) : (
            eventTypes.map((eventType) => (
              <Card key={eventType.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{eventType.name}</CardTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash className="h-4 w-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the event type &quot;{eventType.name}&quot;.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => handleDeleteEventType(eventType.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Priority: {eventType.priority}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
