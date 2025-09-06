import React from 'react'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders hero with CTAs', () => {
    render(<App />)
    expect(screen.getByText(/EDGESIGHT QA/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enter Live/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enter Offline/i })).toBeInTheDocument()
  })
})


