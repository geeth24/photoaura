'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface ServiceType {
  id: number;
  name: string;
}

interface PricingItem {
  id: number;
  session_type: string;
  price: number;
  notes: string;
}

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [pricingData, setPricingData] = useState<PricingItem[]>([]);
  const [date, setDate] = useState<Date | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm({
    defaultValues: {
      client_name: '',
      client_email: '',
      client_phone: '',
      preferred_date: '',
      service_type_id: '',
      additional_notes: '',
    },
  });

  useEffect(() => {
    // Fetch service types from the API
    async function fetchServiceTypes() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/service-types`);
        if (!response.ok) throw new Error('Failed to fetch service types');
        const data = await response.json();
        setServiceTypes(data);
      } catch (error) {
        console.error('Error fetching service types:', error);
        toast.error('Could not load service types. Please try again later.');
      }
    }

    // Fetch pricing information
    async function fetchPricing() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pricing`);
        if (!response.ok) throw new Error('Failed to fetch pricing information');
        const data = await response.json();
        setPricingData(data);
      } catch (error) {
        console.error('Error fetching pricing:', error);
      }
    }

    fetchServiceTypes();
    fetchPricing();
  }, []);

  useEffect(() => {
    if (date) {
      setValue('preferred_date', date.toISOString());
    }
  }, [date, setValue]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Something went wrong');
      }

      toast.success(
        'Booking submitted successfully! We will contact you shortly to confirm your appointment.',
      );
      reset();
      setDate(undefined);
    } catch (error) {
      console.error('Error submitting booking:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit booking. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      <div className="md:col-span-2">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="client_name">Full Name</Label>
              <Input
                id="client_name"
                {...register('client_name', { required: 'Full name is required' })}
                placeholder="John Smith"
                className={cn(errors.client_name && 'border-destructive')}
              />
              {errors.client_name && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.client_name.message?.toString()}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="client_email">Email</Label>
              <Input
                id="client_email"
                type="email"
                {...register('client_email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                placeholder="john.smith@example.com"
                className={cn(errors.client_email && 'border-destructive')}
              />
              {errors.client_email && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.client_email.message?.toString()}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="client_phone">Phone Number</Label>
              <Input
                id="client_phone"
                {...register('client_phone', { required: 'Phone number is required' })}
                placeholder="+1 (234) 567-8901"
                className={cn(errors.client_phone && 'border-destructive')}
              />
              {errors.client_phone && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.client_phone.message?.toString()}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="preferred_date">Preferred Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground',
                      errors.preferred_date && 'border-destructive',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : <span>Select a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
              <input
                type="hidden"
                {...register('preferred_date', { required: 'Please select a date' })}
              />
              {errors.preferred_date && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.preferred_date.message?.toString()}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="service_type_id">Service Type</Label>
              <select
                id="service_type_id"
                {...register('service_type_id', { required: 'Please select a service type' })}
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2',
                  'text-sm ring-offset-background file:border-0 file:bg-transparent',
                  'file:text-sm file:font-medium placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  errors.service_type_id && 'border-destructive',
                )}
              >
                <option value="">Select a service type</option>
                {serviceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {errors.service_type_id && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.service_type_id.message?.toString()}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="additional_notes">Additional Notes (Optional)</Label>
              <textarea
                id="additional_notes"
                {...register('additional_notes')}
                className={cn(
                  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2',
                  'text-sm ring-offset-background placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                placeholder="Any special requests or information we should know"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Book Now'}
          </Button>
        </form>
      </div>

      <div className="md:col-span-1">
        <div className="sticky top-24">
          <h2 className="mb-4 text-xl font-semibold">Our Pricing</h2>
          {pricingData.length > 0 ? (
            <div className="space-y-4">
              {pricingData.map((pricing) => (
                <Card key={pricing.id}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{pricing.session_type}</h3>
                    <p className="my-2 text-xl font-bold">${pricing.price.toFixed(2)}</p>
                    {pricing.notes && (
                      <p className="text-sm text-muted-foreground">{pricing.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Pricing information loading...</p>
          )}

          <div className="mt-6">
            <h3 className="mb-2 text-lg font-semibold">Contact Us</h3>
            <p className="text-sm text-muted-foreground">
              If you have any questions about our services or pricing, feel free to contact us at:
            </p>
            <p className="mt-1 text-sm font-medium">contact@photoaura.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
