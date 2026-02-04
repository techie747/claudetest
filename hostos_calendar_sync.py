#!/usr/bin/env python3
"""
HostOS Calendar Sync AI Assistant
Google AI Studio / Gemini API Implementation

This module provides a chat assistant specialized in calendar synchronization
for Airbnb, Vrbo, and Booking.com platforms.

Usage:
    # As a module
    from hostos_calendar_sync import HostOSCalendarSyncAssistant

    assistant = HostOSCalendarSyncAssistant()
    response = assistant.chat("How do I connect my Airbnb?")
    print(response)

    # As CLI
    python hostos_calendar_sync.py
"""

import os
from dotenv import load_dotenv

try:
    import google.generativeai as genai
except ImportError:
    print("Error: google-generativeai package not installed.")
    print("Run: pip install google-generativeai")
    exit(1)

from hostos_system_instruction import SYSTEM_INSTRUCTION


class HostOSCalendarSyncAssistant:
    """
    AI Assistant for HostOS Calendar Synchronization.

    Specialized in connecting and syncing Airbnb, Vrbo, and Booking.com
    calendars to prevent double-bookings.
    """

    DEFAULT_MODEL = "gemini-1.5-pro"

    def __init__(
        self,
        api_key: str = None,
        model_name: str = None,
        temperature: float = 0.7,
        max_output_tokens: int = 8192,
    ):
        """
        Initialize the HostOS Calendar Sync Assistant.

        Args:
            api_key: Google AI API key. If None, reads from GOOGLE_AI_API_KEY env var.
            model_name: Gemini model to use. Defaults to gemini-1.5-pro.
            temperature: Response creativity (0.0-1.0). Lower = more focused.
            max_output_tokens: Maximum response length.
        """
        load_dotenv()

        self.api_key = api_key or os.getenv("GOOGLE_AI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Google AI API key required. Set GOOGLE_AI_API_KEY environment "
                "variable or pass api_key parameter."
            )

        genai.configure(api_key=self.api_key)

        self.model_name = model_name or self.DEFAULT_MODEL
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens

        self.generation_config = genai.types.GenerationConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_output_tokens,
            top_p=0.95,
            top_k=40,
        )

        self.safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
        ]

        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=self.generation_config,
            safety_settings=self.safety_settings,
            system_instruction=SYSTEM_INSTRUCTION,
        )

        self.chat_session = None

    def start_chat(self, history: list = None) -> None:
        """
        Start a new chat session.

        Args:
            history: Optional list of previous messages to restore context.
        """
        self.chat_session = self.model.start_chat(history=history or [])

    def chat(self, message: str) -> str:
        """
        Send a message and get a response.

        Args:
            message: User's message/question.

        Returns:
            Assistant's response text.
        """
        if self.chat_session is None:
            self.start_chat()

        response = self.chat_session.send_message(message)
        return response.text

    def get_chat_history(self) -> list:
        """
        Get the current chat history.

        Returns:
            List of message objects from the chat session.
        """
        if self.chat_session is None:
            return []
        return self.chat_session.history

    def reset_chat(self) -> None:
        """Reset the chat session, clearing all history."""
        self.chat_session = None

    def generate_single_response(self, prompt: str) -> str:
        """
        Generate a single response without maintaining chat history.

        Useful for one-off questions or when you don't need conversation context.

        Args:
            prompt: The question or prompt to respond to.

        Returns:
            Generated response text.
        """
        response = self.model.generate_content(prompt)
        return response.text


def create_google_ai_studio_config() -> dict:
    """
    Generate configuration for Google AI Studio web interface.

    This config can be used to set up the assistant in the Google AI Studio
    web interface at https://aistudio.google.com

    Returns:
        Dictionary with configuration settings.
    """
    return {
        "model": "gemini-1.5-pro",
        "system_instruction": SYSTEM_INSTRUCTION,
        "generation_config": {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        },
        "safety_settings": {
            "harassment": "BLOCK_MEDIUM_AND_ABOVE",
            "hate_speech": "BLOCK_MEDIUM_AND_ABOVE",
            "sexually_explicit": "BLOCK_MEDIUM_AND_ABOVE",
            "dangerous_content": "BLOCK_MEDIUM_AND_ABOVE",
        }
    }


def print_config_for_studio():
    """Print the system instruction for copying into Google AI Studio."""
    print("=" * 70)
    print("GOOGLE AI STUDIO CONFIGURATION")
    print("=" * 70)
    print("\n1. Go to https://aistudio.google.com")
    print("2. Create a new prompt or chat")
    print("3. Click 'System Instructions' (gear icon)")
    print("4. Paste the following system instruction:\n")
    print("-" * 70)
    print(SYSTEM_INSTRUCTION)
    print("-" * 70)
    print("\n5. Set these generation parameters:")
    print("   - Model: Gemini 1.5 Pro")
    print("   - Temperature: 0.7")
    print("   - Top P: 0.95")
    print("   - Top K: 40")
    print("   - Max Output Tokens: 8192")
    print("=" * 70)


def run_cli():
    """Run the interactive CLI chat interface."""
    print("=" * 60)
    print("HostOS Calendar Sync Assistant")
    print("Connecting Airbnb, Vrbo, and Booking.com")
    print("=" * 60)
    print("\nInitializing...")

    try:
        assistant = HostOSCalendarSyncAssistant()
    except ValueError as e:
        print(f"\nError: {e}")
        print("\nTo set up your API key:")
        print("1. Get an API key from https://aistudio.google.com/apikey")
        print("2. Create a .env file with: GOOGLE_AI_API_KEY=your_key_here")
        print("   Or set the environment variable: export GOOGLE_AI_API_KEY=your_key")
        return

    print("Ready! Type your questions about calendar syncing.")
    print("Commands: 'quit' to exit, 'reset' to clear chat history")
    print("-" * 60)

    while True:
        try:
            user_input = input("\nYou: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ('quit', 'exit', 'q'):
                print("\nGoodbye! Your calendar sync is protecting your income 24/7!")
                break

            if user_input.lower() == 'reset':
                assistant.reset_chat()
                print("\nChat history cleared. Starting fresh!")
                continue

            if user_input.lower() == 'config':
                print_config_for_studio()
                continue

            print("\nAssistant: ", end="", flush=True)
            response = assistant.chat(user_input)
            print(response)

        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")
            print("Please try again or type 'reset' to start a new session.")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--config":
        print_config_for_studio()
    else:
        run_cli()
