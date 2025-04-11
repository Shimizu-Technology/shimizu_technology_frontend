// src/shared/components/examples/RequiredFieldsExample.tsx

import React, { useState } from 'react';
import { Input } from '../ui/Input';

export function RequiredFieldsExample() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Form submitted!');
    console.log(formData);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Form with Required Fields</h2>
      <p className="text-sm text-gray-600 mb-6">
        Fields marked with a <span className="text-red-500">*</span> are required.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="name"
          name="name"
          label="Full Name"
          required
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter your full name"
          tooltip="Please enter your first and last name"
        />

        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          tooltip="We'll never share your email with anyone else"
        />

        <Input
          id="phone"
          name="phone"
          type="tel"
          label="Phone Number"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+1671123456"
          tooltip="Optional: Include country code"
        />

        <Input
          id="message"
          name="message"
          label="Message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Any additional information"
        />

        <button
          type="submit"
          className="w-full bg-[#c1902f] text-white py-2 px-4 rounded-md
                    hover:bg-[#d4a43f] transition-colors duration-200"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

export default RequiredFieldsExample;
