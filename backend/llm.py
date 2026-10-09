"""OpenAI-compatible LLM client, streamed completions, and function-tool loop."""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def is_mock() -> bool:
    return os.getenv("LLM_MODE", "live").lower() == "mock"


def has_api_key() -> bool:
    return bool(os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY"))


def validate_configuration() -> None:
    if not is_mock() and not has_api_key():
        raise RuntimeError("OPENAI_API_KEY is required when LLM_MODE=live.")


def _mock_text(messages: list[dict[str, Any]]) -> str:
    system = next((str(item.get("content", "")) for item in messages if item.get("role") == "system"), "")
    user_messages = [str(item.get("content", "")) for item in messages if item.get("role") == "user"]
    user_text = user_messages[-1] if user_messages else ""
    if not system:
        header = "Executive summary (mock)"
    elif "Planner / Brain Agent" in system:
        header = "📋 PLANNER AGENT — PRICING BLUEPRINT"
    elif "Builder / Coding Agent" in system:
        header = "🔨 BUILDER AGENT — PRICING PIPELINE"
    elif "Critic" in system:
        header = "🔍 CRITIC AGENT — GUARDRAIL REVIEW"
    elif "Executor" in system:
        header = "✅ EXECUTOR AGENT — IMPLEMENTING APPROVED PRICES"
    else:
        header = "Negotiation Agent (mock)"
    excerpt = user_text[:80].replace("\n", " ")
    return f"{header}\n[mock] {excerpt}"


async def stream_text(
    messages: list[dict[str, Any]], max_tokens: int
) -> AsyncIterator[str]:
    if is_mock():
        words = _mock_text(messages).split(" ")
        for index, word in enumerate(words):
            await asyncio.sleep(0)
            yield word + (" " if index < len(words) - 1 else "")
        return

    client = _get_client()
    response = await client.chat.completions.create(
        model=MODEL, messages=messages, max_tokens=max_tokens, stream=True
    )
    async for event in response:
        content = event.choices[0].delta.content
        if content:
            yield content


async def complete_text(messages: list[dict[str, Any]], max_tokens: int) -> str:
    if is_mock():
        return _mock_text(messages)

    client = _get_client()
    response = await client.chat.completions.create(
        model=MODEL, messages=messages, max_tokens=max_tokens
    )
    return response.choices[0].message.content or ""


async def stream_tool_agent(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    handler: Callable[[str, dict[str, Any]], Any],
    max_tokens: int,
) -> AsyncIterator[dict[str, Any]]:
    """Let the model request whitelisted app functions, execute them, then stream its synthesis."""
    if is_mock():
        # Keep the offline path deterministic while exercising the same real app actions.
        for tool in tools:
            fn = tool["function"]
            result = handler(fn["name"], {})
            yield {"tool_call": {"name": fn["name"], "category": "Pricing Pipeline", "args": {}, "result": result}}
        async for chunk in stream_text(messages, max_tokens):
            yield {"chunk": chunk}
        return

    client = _get_client()
    conversation = list(messages)
    for turn in range(5):
        response = await client.chat.completions.create(
            model=MODEL,
            messages=conversation,
            tools=tools,
            tool_choice="required" if turn == 0 else "auto",
            max_tokens=max_tokens,
        )
        message = response.choices[0].message
        if not message.tool_calls:
            if message.content:
                yield {"chunk": message.content}
            return
        conversation.append(message.model_dump(exclude_none=True))
        for call in message.tool_calls:
            name = call.function.name
            arguments = json.loads(call.function.arguments or "{}")
            result = handler(name, arguments)
            yield {"tool_call": {"name": name, "category": "Pricing Pipeline", "args": arguments, "result": result}}
            conversation.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result, ensure_ascii=False, default=str)})
    # Final synthesis after tool execution; don't offer tools at this point to avoid runaway loops.
    async for chunk in stream_text(conversation, max_tokens):
        yield {"chunk": chunk}


def _get_client():
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required when LLM_MODE=live.")
    from openai import AsyncOpenAI

    if os.getenv("OPENAI_API_KEY"):
        return AsyncOpenAI(api_key=api_key)
    return AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)
