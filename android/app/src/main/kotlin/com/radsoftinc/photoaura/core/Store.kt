package com.radsoftinc.photoaura.core

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Base for feature stores — the Android twin of the iOS @Observable stores.
 * A feature owns one immutable State and handles every Intent through send().
 */
abstract class Store<State, Intent>(initial: State) : ViewModel() {
    private val _state = MutableStateFlow(initial)
    val state: StateFlow<State> = _state.asStateFlow()
    protected val current: State get() = _state.value

    abstract fun send(intent: Intent)

    protected fun setState(reduce: State.() -> State) {
        _state.value = _state.value.reduce()
    }

    /** Async work on the store's scope; Ktor suspends off the main thread, results land back on it. */
    protected fun io(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}

fun Throwable.friendly(): String = when (this) {
    is ApiException -> message
    is java.net.UnknownHostException, is java.net.ConnectException -> "You're offline."
    else -> message ?: "Something went wrong."
}
